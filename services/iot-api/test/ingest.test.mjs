import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';

import {Cloud} from '../src/cloud.js';
import {openDatabase} from '../src/db.js';
import {runRetention, runRollups} from '../src/jobs.js';
import {Repo} from '../src/repo.js';
import {FakeBroker, clock, telemetry, testConfig} from './helpers.mjs';

const user = {sub: 'u1', email: 'alice@example.com'};
let repo;
let broker;
let cloud;
let now;
let events;
let device;

const fresh = () => repo.getDevice(device.id);
const status = (payload, retained = false) =>
    cloud.handleMessage(`tb/${device.id}/status`, Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)), retained);
const send = (v, seq, boot) => cloud.handleMessage(`tb/${device.id}/telemetry`, telemetry(v, seq, boot), false);

beforeEach(async () => {
    repo = new Repo(openDatabase(':memory:'));
    broker = new FakeBroker();
    now = clock();
    events = [];
    cloud = new Cloud({
        config: testConfig(),
        repo,
        broker,
        live: {publish: (sub, e) => events.push(Object.assign({sub}, e))},
        now
    });
    repo.touchUser(user.sub, user.email, now());
    const created = await cloud.createDevice(user, 'Lamp');
    device = created.device;
});

test('create publishes retained initial state for every control', () => {
    const states = broker.published.filter(p => p.topic.startsWith(`tb/${device.id}/state/`));
    assert.equal(states.length, 6);
    assert.ok(states.every(s => s.retain === true && s.qos === 1));
    assert.deepEqual(JSON.parse(states[0].payload), {v: 0, ver: 1, fs: 120, fv: 0});
});

test('telemetry is stored, pushed live, and duplicate seq is ignored', () => {
    status({s: 'online', boot: 'abc1', rssi: -50, tr: 'mqtts'});
    send({distance: 30}, 1);
    now.advance(10000);
    send({distance: 31}, 1);
    assert.equal(cloud.stats.duplicates, 1);
    now.advance(10000);
    send({distance: 32}, 2);
    const latest = repo.latestFor(device.id);
    assert.equal(latest[0].value, 32);
    assert.ok(events.some(e => e.type === 'reading' && e.v.distance === 30 && e.sub === 'u1'));
});

test('a new boot id resets the sequence so a rebooted board is not treated as a replay', () => {
    send({distance: 30}, 50, 'aaa1');
    now.advance(10000);
    send({distance: 31}, 1, 'bbb2');
    assert.equal(repo.latestFor(device.id)[0].value, 31);
});

test('messages faster than the minimum interval are dropped; sustained flooding pauses the device', async () => {
    send({distance: 1}, 1);
    now.advance(1000);
    send({distance: 2}, 2);
    assert.equal(repo.latestFor(device.id)[0].value, 1, 'too-fast message dropped');
    for (let i = 3; i < 130; i++) {
        now.advance(100);
        send({distance: i}, i);
    }
    await new Promise(r => setImmediate(r));
    assert.equal(fresh().status, 'disabled');
    assert.equal(fresh().disabled_reason, 'flooding');
    assert.equal(broker.callsOf('disable').length, 1);
    assert.ok(events.some(e => e.type === 'alert' && e.alert.kind === 'disabled'));
    const before = repo.latestFor(device.id)[0].value;
    now.advance(60000);
    send({distance: 999}, 500);
    assert.equal(repo.latestFor(device.id)[0].value, before, 'disabled devices are ignored');
});

test('offline alert waits for the grace period and is sent once per outage', () => {
    status({s: 'online', boot: 'abc1'});
    status('offline');
    assert.equal(fresh().status, 'offline');
    cloud.sweepStatus();
    assert.equal(repo.listAlerts('u1', {limit: 10}).length, 0, 'no alert inside grace');
    now.advance(61000);
    cloud.sweepStatus();
    cloud.sweepStatus();
    const alerts = repo.listAlerts('u1', {limit: 10});
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].kind, 'offline');
    status({s: 'online', boot: 'abc1'});
    status('offline');
    now.advance(10000);
    status({s: 'online', boot: 'abc1'});
    now.advance(61000);
    cloud.sweepStatus();
    assert.equal(repo.listAlerts('u1', {limit: 10}).length, 1, 'quick reconnect does not alert');
});

test('stale "online" with no traffic becomes offline even without an LWT', () => {
    status({s: 'online', boot: 'abc1'});
    now.advance(5 * 60 * 1000);
    cloud.sweepStatus();
    assert.equal(fresh().status, 'offline');
});

test('heartbeats keep a board with no sensors online without storing readings', () => {
    status({s: 'online', fw: 'studio-2', boot: 'abc1'});
    for (let i = 1; i <= 10; i++) {
        now.advance(30000);
        cloud.handleMessage(`tb/${device.id}/telemetry`, Buffer.from(JSON.stringify({seq: i, boot: 'abc1', v: {}})), false);
        cloud.sweepStatus();
    }
    assert.equal(fresh().status, 'online');
    assert.equal(repo.latestFor(device.id).length, 0);
    assert.ok(!events.some(e => e.type === 'reading'), 'heartbeats are not pushed as readings');
});

test('an ack from a stale-swept board brings it back online', async () => {
    status({s: 'online', fw: 'studio-2', boot: 'abc1'});
    now.advance(5 * 60 * 1000);
    cloud.sweepStatus();
    assert.equal(fresh().status, 'offline');
    await cloud.setControl(user, fresh(), 'switch1', {value: 1, expectedVersion: 1});
    events = [];
    cloud.handleMessage(`tb/${device.id}/ack`, Buffer.from(JSON.stringify({key: 'switch1', ver: 2})), false);
    assert.equal(fresh().status, 'online');
    assert.ok(events.some(e => e.type === 'status' && e.status === 'online'));
    assert.equal(repo.getControl(device.id, 'switch1').acked_version, 2);
});

test('older firmware without heartbeats stays online until the broker reports it gone', () => {
    status({s: 'online', fw: 'studio-1', boot: 'abc1'});
    now.advance(10 * 60 * 1000);
    cloud.sweepStatus();
    assert.equal(fresh().status, 'online');
    status('offline');
    assert.equal(fresh().status, 'offline');
});

test('retained replays do not count as restarts; repeated new boots raise one warning', () => {
    status({s: 'online', boot: 'abc1'}, true);
    status({s: 'online', boot: 'abc1'}, true);
    assert.equal(fresh().restart_count, 0);
    for (let i = 0; i < 8; i++) {
        now.advance(30000);
        status({s: 'online', boot: `b${i}`});
    }
    assert.equal(fresh().warning, 'restarting');
    assert.equal(repo.listAlerts('u1', {limit: 10}).filter(a => a.kind === 'warning').length, 1);
    now.advance(2 * 3600 * 1000);
    status({s: 'online', boot: 'zzz9'});
    now.advance(1000);
    cloud.sweepStatus();
});

test('acks only move forward and only for versions the server issued', async () => {
    const res = await cloud.setControl(user, fresh(), 'switch1', {value: 1, expectedVersion: 1});
    assert.equal(res.control.version, 2);
    assert.equal(res.delivered, true);
    const ack = v => cloud.handleMessage(`tb/${device.id}/ack`, Buffer.from(JSON.stringify({key: 'switch1', ver: v})), false);
    ack(99);
    assert.equal(repo.getControl(device.id, 'switch1').acked_version, 0);
    ack(2);
    assert.equal(repo.getControl(device.id, 'switch1').acked_version, 2);
    ack(1);
    assert.equal(repo.getControl(device.id, 'switch1').acked_version, 2);
});

test('control writes use optimistic versions and survive a broker outage', async () => {
    await cloud.setControl(user, fresh(), 'slider1', {value: 40, expectedVersion: 1});
    await assert.rejects(cloud.setControl(user, fresh(), 'slider1', {value: 50, expectedVersion: 1}), err => {
        assert.equal(err.status, 409);
        assert.equal(err.extra.control.value, 40);
        return true;
    });
    broker.connected = false;
    const res = await cloud.setControl(user, fresh(), 'slider1', {value: 60, expectedVersion: 2});
    assert.equal(res.delivered, false);
    broker.connected = true;
    broker.published = [];
    await cloud.republishAll();
    const slider = broker.published.find(p => p.topic.endsWith('/state/slider1'));
    assert.deepEqual(JSON.parse(slider.payload), {v: 60, ver: 3, fs: 120, fv: 0});
});

test('device alerts are cleaned, de-duplicated and capped', () => {
    const alert = t => cloud.handleMessage(`tb/${device.id}/alert`, Buffer.from(t), false);
    alert('Water low');
    alert('Water low');
    assert.equal(repo.listAlerts('u1', {limit: 50}).length, 1);
    for (let i = 0; i < 30; i++) {
        alert(`msg ${i}`);
    }
    assert.equal(repo.listAlerts('u1', {limit: 50}).length, 20);
});

test('rules fire through ingest with hysteresis', () => {
    repo.insertRule(device.id, 'r_1', {key: 'distance', op: '<', threshold: 10, hysteresis: 2, cooldownSec: 0, message: '', enabled: true}, now());
    send({distance: 20}, 1);
    now.advance(10000);
    send({distance: 5}, 2);
    now.advance(10000);
    send({distance: 11}, 3);
    now.advance(10000);
    send({distance: 4}, 4);
    now.advance(10000);
    send({distance: 13}, 5);
    now.advance(10000);
    send({distance: 3}, 6);
    const rules = repo.listAlerts('u1', {limit: 50}).filter(a => a.kind === 'rule');
    assert.equal(rules.length, 2);
    assert.match(rules[0].message, /distance is 3/);
});

test('unknown, malformed, deleted and foreign topics are ignored', async () => {
    cloud.handleMessage('tb/d_zzzzzzzzzz/telemetry', telemetry({a: 1}, 1), false);
    cloud.handleMessage(`tb/${device.id}/state/switch1`, Buffer.from('{}'), false);
    cloud.handleMessage(`tb/${device.id}/telemetry/extra`, telemetry({a: 1}, 1), false);
    cloud.handleMessage(`tb/${device.id}/telemetry`, Buffer.from('garbage'), false);
    assert.equal(repo.latestFor(device.id).length, 0);
    await cloud.deleteDevice(user, fresh());
    send({distance: 1}, 1);
    assert.equal(repo.latestFor(device.id).length, 0);
    assert.ok(broker.published.some(p => p.topic === `tb/${device.id}/status` && p.payload === '' && p.retain));
});

test('delete while the broker is down is retried later', async () => {
    broker.fail = true;
    await cloud.deleteDevice(user, fresh());
    assert.equal(fresh().broker_pending, 'disable');
    broker.fail = false;
    await cloud.retryBrokerPending();
    assert.equal(fresh().broker_pending, null);
    assert.equal(broker.callsOf('disable').length, 2);
});

test('broker failure during create leaves no database row', async () => {
    broker.fail = true;
    await assert.rejects(cloud.createDevice(user, 'Second'), err => err.status === 503);
    assert.equal(repo.countActiveDevices('u1'), 1);
});

test('soft-deleted devices are purged after 7 days', async () => {
    await cloud.deleteDevice(user, fresh());
    await cloud.purgeDeleted();
    assert.ok(fresh(), 'kept during the undo window');
    now.advance(8 * 24 * 3600 * 1000);
    await cloud.purgeDeleted();
    assert.equal(fresh(), null);
    assert.equal(broker.callsOf('remove').length, 1);
});

test('rollups aggregate exactly once and retention trims old data', () => {
    const start = Math.floor(now() / 60000) * 60000;
    now.set(start);
    for (let i = 0; i < 12; i++) {
        send({distance: i}, i + 1);
        now.advance(10000);
    }
    runRollups(repo, now());
    runRollups(repo, now());
    const minutes = repo.history(device.id, 'distance', '1m', 0, now());
    assert.equal(minutes.length, 2);
    assert.equal(minutes[0][1], 2.5);
    assert.equal(minutes[1][1], 8.5);
    now.advance(3 * 24 * 3600 * 1000);
    const purged = runRetention(repo, now());
    assert.equal(purged.raw, 12);
    assert.equal(repo.history(device.id, 'distance', '1m', 0, now()).length, 2, 'minute rollups kept 30 days');
});
