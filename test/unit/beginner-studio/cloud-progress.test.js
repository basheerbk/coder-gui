import {
    cameOnline,
    createLineSplitter,
    initialProgress,
    parseCloudLine,
    reduceProgress,
    uniqueBoardName
} from '../../../src/beginner-studio/domain/cloudProgress';

const run = lines => lines.reduce((state, line) => {
    const event = typeof line === 'string' ? parseCloudLine(line) : line;
    return event ? reduceProgress(state, event) : state;
}, initialProgress());

describe('cloud go-live progress', () => {
    test('reads the lines the firmware prints', () => {
        expect(parseCloudLine('Cloud: joining WiFi "Home"')).toEqual({type: 'wifi_joining'});
        expect(parseCloudLine('Cloud: WiFi connected (RSSI -61)\r')).toEqual({type: 'wifi_ok'});
        expect(parseCloudLine('Cloud: WiFi name not found - check spelling, 2.4 GHz networks only').type)
            .toBe('wifi_not_found');
        expect(parseCloudLine('Cloud: wrong WiFi password?').type).toBe('wifi_password');
        expect(parseCloudLine('Cloud: connecting to mqtts://api.tinkerbit.io:8883').type).toBe('cloud_connecting');
        expect(parseCloudLine('Cloud: connected (port 8883)').type).toBe('cloud_ok');
        expect(parseCloudLine('Cloud: login rejected - re-upload from Studio (trying again in 5 min)').type)
            .toBe('cloud_rejected');
        expect(parseCloudLine('Cloud: switch1 = 1')).toBeNull();
        expect(parseCloudLine('Soil: 42')).toBeNull();
    });

    test('happy path ends live once the Cloud service sees the board', () => {
        let s = run(['Cloud: joining WiFi "Home"', 'Cloud: WiFi connected (RSSI -50)', 'Cloud: connecting to x']);
        expect(s).toMatchObject({wifi: 'done', cloud: 'active', live: 'waiting'});
        s = reduceProgress(reduceProgress(s, parseCloudLine('Cloud: connected (port 8883)')), {type: 'server_online'});
        expect(s).toEqual({wifi: 'done', cloud: 'done', live: 'done', problem: null});
    });

    test('a wrong password stays visible through the reconnect noise, and clears when WiFi works', () => {
        let s = run(['Cloud: joining WiFi "Home"', 'Cloud: wrong WiFi password?', 'Cloud: WiFi lost (reason 2) - reconnecting']);
        expect(s.wifi).toBe('failed');
        expect(s.problem).toBe('wifi_password');
        s = reduceProgress(s, {type: 'wifi_ok'});
        expect(s.wifi).toBe('done');
        expect(s.problem).toBeNull();
    });

    test('rejected key and timeout', () => {
        expect(run(['Cloud: WiFi connected', 'Cloud: login rejected - re-upload']).problem).toBe('cloud_rejected');
        expect(run([{type: 'timeout'}]).problem).toBe('timeout');
        expect(run(['Cloud: WiFi name not found', {type: 'timeout'}]).problem).toBe('wifi_not_found');
        expect(run([{type: 'server_online'}, {type: 'timeout'}]).problem).toBeNull();
    });

    test('server alone can confirm the board (no USB reading, e.g. another browser)', () => {
        expect(run([{type: 'server_online'}]).live).toBe('done');
    });

    test('line splitter joins chunks split mid-line', () => {
        const got = [];
        const feed = createLineSplitter(l => got.push(l));
        feed('Cloud: join');
        feed('ing WiFi "A"\r\nCloud: WiFi con');
        feed('nected\n');
        expect(got).toEqual(['Cloud: joining WiFi "A"', 'Cloud: WiFi connected']);
    });

    test('cameOnline compares with the board before the upload, not clocks', () => {
        const before = {status: 'online', onlineSince: 1000};
        expect(cameOnline({status: 'online', onlineSince: 1000}, before)).toBe(false);
        expect(cameOnline({status: 'online', onlineSince: 5000}, before)).toBe(true);
        expect(cameOnline({status: 'online', onlineSince: 5000}, {status: 'never'})).toBe(true);
        expect(cameOnline({status: 'online', onlineSince: 5000}, null)).toBe(true);
        expect(cameOnline({status: 'offline', onlineSince: 5000}, before)).toBe(false);
        expect(cameOnline(null, before)).toBe(false);
    });

    test('uniqueBoardName avoids duplicates, ignoring case, within 40 characters', () => {
        expect(uniqueBoardName('Smart Garden', [])).toBe('Smart Garden');
        expect(uniqueBoardName('Smart Garden', ['smart garden'])).toBe('Smart Garden 2');
        expect(uniqueBoardName('Smart Garden', ['Smart Garden', 'Smart Garden 2'])).toBe('Smart Garden 3');
        expect(uniqueBoardName('   ', [])).toBe('My board');
        const long = 'x'.repeat(40);
        const named = uniqueBoardName(long, [long]);
        expect(named.length).toBeLessThanOrEqual(40);
        expect(named.endsWith(' 2')).toBe(true);
    });
});
