#!/usr/bin/env node
/**
 * Load / soak simulator for TinkerBit Cloud. Behaves like the Studio firmware:
 * last will "offline", retained online status, telemetry with seq + boot id,
 * subscribes to state/# and acks every control version it applies.
 *
 *   provision:  node tools/simulate-devices.mjs provision --count 100 --api http://127.0.0.1:20114
 *   run:        node tools/simulate-devices.mjs run --broker mqtts://api.tinkerbit.io:8883 --interval 10
 *   cleanup:    node tools/simulate-devices.mjs cleanup --api http://127.0.0.1:20114
 *
 * provision/cleanup mint session cookies with AUTH_SECRET for sim-NN@loadtest.tinkerbit.io
 * users, so IOT_ALLOWLIST must include them (or be "*") while the test runs.
 * Credentials are written to --file (default ./sim-devices.json, mode 0600).
 */
import {readFileSync, writeFileSync, existsSync, chmodSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

import {SignJWT} from 'jose';
import mqtt from 'mqtt';

const args = process.argv.slice(2);
const command = args[0] || 'help';
const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
};
const flag = name => args.includes(`--${name}`);

const FILE = opt('file', './sim-devices.json');
const API = (opt('api', process.env.IOT_SIM_API || 'http://127.0.0.1:20114')).replace(/\/$/, '');
const ORIGIN = opt('origin', 'https://www.tinkerbit.io');
const PER_USER = 10;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cookieFor (n) {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('AUTH_SECRET (same as the service) is required to provision');
    }
    const sub = `sim-${String(n).padStart(2, '0')}`;
    const jwt = await new SignJWT({email: `${sub}@loadtest.tinkerbit.io`, name: sub})
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret));
    return `tb_session=${jwt}`;
}

async function api (cookie, method, path, body) {
    const headers = {cookie};
    if (method !== 'GET') {
        headers.origin = ORIGIN;
        headers['content-type'] = 'application/json';
    }
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`${API}/iot/v1${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (res.status === 429) {
            await sleep(1000 * Number(res.headers.get('retry-after') || 1));
            continue;
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
        }
        return json;
    }
    throw new Error(`${method} ${path} kept hitting the rate limit`);
}

async function provision () {
    const count = Number(opt('count', '100'));
    const devices = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
    const users = Math.ceil(count / PER_USER);
    for (let u = 0; u < users && devices.length < count; u++) {
        const cookie = await cookieFor(u);
        const have = (await api(cookie, 'GET', '/devices')).devices.length;
        for (let i = have; i < PER_USER && devices.length < count; i++) {
            const created = await api(cookie, 'POST', '/devices', {name: `Sim ${u}-${i}`});
            devices.push({id: created.device.id, token: created.token, user: u});
            process.stdout.write('.');
        }
    }
    writeFileSync(FILE, JSON.stringify(devices, null, 2));
    try {
        chmodSync(FILE, 0o600);
    } catch (err) {
        // Windows: permissions are not POSIX.
    }
    console.log(`\n${devices.length} simulated devices in ${FILE}`);
}

async function cleanup () {
    const users = Number(opt('users', '20'));
    let removed = 0;
    for (let u = 0; u < users; u++) {
        const cookie = await cookieFor(u);
        const res = await api(cookie, 'DELETE', '/me/data', {confirm: 'DELETE'}).catch(() => null);
        if (res) {
            removed++;
        }
    }
    console.log(`Removed data for ${removed} sim users (devices are purged by the retention job)`);
}

function startDevice (dev, cfg, stats) {
    const base = `tb/${dev.id}`;
    const boot = randomBytes(4).toString('hex');
    let seq = 0;
    let timer = null;
    const state = {};

    const client = mqtt.connect(cfg.broker, {
        clientId: dev.id,
        username: dev.id,
        password: dev.token,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 2000 + Math.floor(Math.random() * 3000),
        connectTimeout: 15000,
        rejectUnauthorized: !cfg.insecure,
        will: {topic: `${base}/status`, payload: 'offline', qos: 1, retain: true}
    });

    const sendTelemetry = () => {
        if (!client.connected) {
            return;
        }
        seq++;
        const v = {
            temp: Math.round((22 + (5 * Math.sin(Date.now() / 600000)) + (Math.random() - 0.5)) * 10) / 10,
            hum: Math.round(45 + (10 * Math.random())),
            dist: Math.round(10 + (Math.random() * 190))
        };
        client.publish(`${base}/telemetry`, JSON.stringify({seq, boot, v}), {qos: 0});
        stats.sent++;
        if (cfg.duplicates && Math.random() < 0.05) {
            client.publish(`${base}/telemetry`, JSON.stringify({seq, boot, v}), {qos: 0});
            stats.duplicates++;
        }
    };

    client.on('connect', () => {
        stats.connected++;
        client.publish(`${base}/status`, JSON.stringify({
            s: 'online', fw: 'sim-1', rssi: -40 - Math.floor(Math.random() * 40), boot, tr: 'mqtts'
        }), {qos: 1, retain: true});
        client.subscribe(`${base}/state/#`, {qos: 1});
        clearInterval(timer);
        const jitter = Math.floor(Math.random() * cfg.interval * 1000);
        setTimeout(() => {
            sendTelemetry();
            timer = setInterval(sendTelemetry, cfg.interval * 1000);
        }, jitter);
    });
    client.on('close', () => {
        clearInterval(timer);
    });
    client.on('error', err => {
        stats.errors++;
        if (/not authorized|bad user name or password/i.test(err.message)) {
            stats.authRejected++;
            client.end(true);
        }
    });
    client.on('message', (topic, payload) => {
        const key = topic.slice(`${base}/state/`.length);
        if (!payload.length) {
            return;
        }
        try {
            const msg = JSON.parse(payload.toString());
            if (state[key] === undefined || msg.ver > state[key]) {
                state[key] = msg.ver;
                stats.controls++;
                client.publish(`${base}/ack`, JSON.stringify({key, ver: msg.ver}), {qos: 1});
            }
        } catch (err) {
            stats.badState++;
        }
    });

    return {
        client,
        crash () {
            // Abrupt socket close: the broker publishes the last will.
            client.stream.destroy();
        },
        flood () {
            for (let i = 0; i < 50; i++) {
                sendTelemetry();
            }
        },
        stop () {
            clearInterval(timer);
            if (!client.connected) {
                return new Promise(r => client.end(true, {}, r));
            }
            return new Promise(r => {
                client.publish(`${base}/status`, 'offline', {qos: 1, retain: true}, () => client.end(false, {}, r));
            });
        }
    };
}

async function run () {
    if (!existsSync(FILE)) {
        throw new Error(`${FILE} not found; run "provision" first`);
    }
    const devices = JSON.parse(readFileSync(FILE, 'utf8'));
    const cfg = {
        broker: opt('broker', 'mqtts://api.tinkerbit.io:8883'),
        interval: Math.max(1, Number(opt('interval', '10'))),
        insecure: flag('insecure'),
        duplicates: flag('duplicates')
    };
    const chaos = flag('chaos');
    const stats = {sent: 0, duplicates: 0, connected: 0, controls: 0, errors: 0, authRejected: 0, badState: 0};
    const sims = [];
    for (const dev of devices) {
        sims.push(startDevice(dev, cfg, stats));
        await sleep(50);
    }
    console.log(`Started ${sims.length} devices against ${cfg.broker} every ${cfg.interval}s${chaos ? ' (chaos)' : ''}`);

    const report = setInterval(() => {
        const online = sims.filter(s => s.client.connected).length;
        console.log(JSON.stringify(Object.assign({ts: new Date().toISOString(), online}, stats)));
    }, 10000);

    let chaosTimer = null;
    if (chaos) {
        chaosTimer = setInterval(() => {
            const sim = sims[Math.floor(Math.random() * sims.length)];
            if (Math.random() < 0.7) {
                sim.crash();
            } else {
                sim.flood();
            }
        }, 15000);
    }

    const shutdown = async () => {
        clearInterval(report);
        clearInterval(chaosTimer);
        console.log('Stopping (publishing offline, then disconnecting)...');
        await Promise.all(sims.map(s => s.stop()));
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

const commands = {provision, cleanup, run};
if (!commands[command]) {
    console.log('Usage: simulate-devices.mjs <provision|run|cleanup> [--count N] [--api URL] [--broker URL] ' +
        '[--interval S] [--file PATH] [--insecure] [--duplicates] [--chaos]');
    process.exit(command === 'help' ? 0 : 2);
}
commands[command]().catch(err => {
    console.error(err.message);
    process.exit(1);
});
