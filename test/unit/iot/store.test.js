import {formatValue, newWidgetId, prettyKey, rssiBars, timeAgo} from '../../../src/iot/format';
import {parseRoute} from '../../../src/iot/router';
import {initialState, reducer} from '../../../src/iot/store';

const device = {id: 'd_abcdefgh23', name: 'Lamp', status: 'offline', intervalSec: 10, lastSeen: null};
const control = (key, version, ackedVersion, value = 0) => ({key, kind: 'switch', value, version, ackedVersion});

const loaded = () => {
    let s = reducer(initialState, {type: 'devices/loaded', devices: [Object.assign({latest: []}, device)], unread: 2});
    s = reducer(s, {
        type: 'detail/loaded',
        id: device.id,
        detail: {
            device,
            latest: [],
            controls: [control('switch1', 3, 3)],
            dashboard: {layout: [], version: 1, isDefault: true},
            rules: []
        }
    });
    return s;
};

describe('iot routes', () => {
    test('parses known pages and falls back to the list', () => {
        expect(parseRoute('/iot')).toEqual({page: 'devices'});
        expect(parseRoute('/iot/')).toEqual({page: 'devices'});
        expect(parseRoute('/iot/d/d_abcdefgh23')).toEqual({page: 'device', id: 'd_abcdefgh23'});
        expect(parseRoute('/iot/alerts')).toEqual({page: 'alerts'});
        expect(parseRoute('/iot/account/')).toEqual({page: 'account'});
        expect(parseRoute('/iot/d/../../etc')).toEqual({page: 'devices'});
        expect(parseRoute('/iot/d/<script>')).toEqual({page: 'devices'});
    });
});

describe('iot store reducer', () => {
    test('live readings update list, detail and chart series', () => {
        let s = loaded();
        s = reducer(s, {type: 'event/reading', event: {deviceId: device.id, ts: 1000, v: {distance: 42}}});
        s = reducer(s, {type: 'event/reading', event: {deviceId: device.id, ts: 2000, v: {distance: 40, heartRate: 70}}});
        expect(s.devices[0].status).toBe('online');
        expect(s.devices[0].latest.map(r => r.key)).toEqual(['distance', 'heartRate']);
        expect(s.details[device.id].latest.find(r => r.key === 'distance').value).toBe(40);
        expect(s.recent[device.id].distance).toEqual([[1000, 42], [2000, 40]]);
    });

    test('readings never flip a paused board to online', () => {
        let s = reducer(loaded(), {type: 'device/upsert', device: {id: device.id, status: 'disabled'}});
        s = reducer(s, {type: 'event/reading', event: {deviceId: device.id, ts: 1, v: {x: 1}}});
        expect(s.devices[0].status).toBe('disabled');
        expect(s.details[device.id].device.status).toBe('disabled');
    });

    test('malformed reading events are ignored', () => {
        const s = loaded();
        expect(reducer(s, {type: 'event/reading', event: {deviceId: device.id, ts: 1, v: null}})).toBe(s);
    });

    test('chart series stay bounded', () => {
        let s = loaded();
        for (let i = 0; i < 700; i++) {
            s = reducer(s, {type: 'event/reading', event: {deviceId: device.id, ts: i, v: {t: i}}});
        }
        expect(s.recent[device.id].t.length).toBe(600);
        expect(s.recent[device.id].t[599]).toEqual([699, 699]);
    });

    test('older control events do not overwrite newer state', () => {
        let s = loaded();
        s = reducer(s, {type: 'control/update', id: device.id, control: control('switch1', 4, 3, 1)});
        expect(s.details[device.id].controls[0].version).toBe(4);
        s = reducer(s, {type: 'control/update', id: device.id, control: control('switch1', 3, 3, 0)});
        expect(s.details[device.id].controls[0].value).toBe(1);
        s = reducer(s, {type: 'control/update', id: device.id, control: control('switch1', 4, 4, 1)});
        expect(s.details[device.id].controls[0].ackedVersion).toBe(4);
    });

    test('status events carry rssi and transport', () => {
        const s = reducer(loaded(), {type: 'event/status', event: {deviceId: device.id, status: 'online', rssi: -60, transport: 'wss'}});
        expect(s.devices[0]).toEqual(expect.objectContaining({status: 'online', rssi: -60, transport: 'wss'}));
        expect(s.details[device.id].device.transport).toBe('wss');
    });

    test('deleted devices disappear everywhere', () => {
        const s = reducer(loaded(), {type: 'device/removed', id: device.id});
        expect(s.devices).toEqual([]);
        expect(s.details[device.id]).toBeUndefined();
    });

    test('alerts: dedupe, unread count and mark read', () => {
        let s = loaded();
        const alert = {id: 9, deviceId: device.id, message: 'Hot', ts: 1, read: false};
        s = reducer(s, {type: 'alerts/new', alert});
        s = reducer(s, {type: 'alerts/new', alert});
        expect(s.alerts.items.length).toBe(1);
        expect(s.unread).toBe(3);
        expect(s.toast).toBe(alert);
        s = reducer(s, {type: 'alerts/read', upToId: 9, updated: 3});
        expect(s.unread).toBe(0);
        expect(s.alerts.items[0].read).toBe(true);
    });
});

describe('iot formatting', () => {
    test('values, signal and keys', () => {
        expect(formatValue(null)).toBe('—');
        expect(formatValue(NaN)).toBe('—');
        expect(formatValue(21.456, '°C')).toBe('21.5 °C');
        expect(formatValue(3.14159)).toBe('3.14');
        expect(formatValue(1234.6)).toBe('1235');
        expect(formatValue(7)).toBe('7');
        expect(rssiBars(-50)).toBe(4);
        expect(rssiBars(-80)).toBe(1);
        expect(rssiBars(null)).toBe(0);
        expect(prettyKey('heartRate')).toBe('Heart Rate');
        expect(timeAgo(null)).toBe('never');
        expect(timeAgo(1000, 1000 + (5 * 60e3))).toBe('5 min ago');
    });

    test('widget ids are unique and match the server pattern', () => {
        const ids = [];
        for (let i = 0; i < 50; i++) {
            ids.push(newWidgetId(ids));
        }
        expect(new Set(ids).size).toBe(50);
        ids.forEach(id => expect(id).toMatch(/^[a-zA-Z0-9_-]{1,16}$/));
    });
});
