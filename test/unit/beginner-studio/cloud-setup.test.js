import {CLOUD_LOCKED_PORTS, cloudUploadProblem} from '../../../src/beginner-studio/domain/cloud';
import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {telemetryReadings, usedCloudControls} from '../../../src/beginner-studio/domain/cloudFirmware';
import {
    forgetAll,
    maskSecrets,
    readLastDevice,
    readSecrets,
    readToken,
    readWifi,
    writeLastDevice,
    writeToken,
    writeWifi
} from '../../../src/beginner-studio/domain/cloudSecrets';
import {CLOUD_SPECS, templateById} from '../../../src/beginner-studio/domain/templates';

const TOKEN = `tbd_${'B'.repeat(43)}`;

const memoryStorage = () => {
    const data = {};
    return {
        get length () {
            return Object.keys(data).length;
        },
        key: i => Object.keys(data)[i] || null,
        getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => {
            data[k] = String(v);
        },
        removeItem: k => {
            delete data[k];
        }
    };
};

const installStorage = () => {
    const win = typeof window === 'undefined' ? (global.window = {}) : window;
    Object.defineProperty(win, 'localStorage', {value: memoryStorage(), configurable: true});
    Object.defineProperty(win, 'sessionStorage', {value: memoryStorage(), configurable: true});
};

describe('cloud templates', () => {
    test('every Cloud template builds and keeps A1–A4 free', () => {
        CLOUD_SPECS.forEach(spec => {
            const tpl = templateById(spec.id);
            expect(tpl).toBeTruthy();
            expect(tpl.cloud).toBe(true);
            tpl.connections.forEach(c => {
                expect(CLOUD_LOCKED_PORTS).not.toContain(c.portId);
            });
            expect(tpl.connections.some(c => c.moduleId === 'cloud' && c.portId === 'ONBOARD')).toBe(true);
        });
    });

    test('templates compile into Cloud sketches without #error lines', () => {
        CLOUD_SPECS.forEach(spec => {
            const tpl = templateById(spec.id);
            const code = generateArduino(tpl.connections, tpl.program, {cloud: {deviceId: 'd_abcdefgh23', intervalSec: 10}});
            expect(code).toContain('cloudSetup();');
            expect(code).not.toMatch(/#error/);
        });
    });

    test('dashboard controls and readings are detected from the program', () => {
        expect(usedCloudControls(templateById('cloud-relays').program))
            .toEqual(['switch1', 'switch2', 'switch3', 'switch4']);
        expect(usedCloudControls(templateById('cloud-fan').program)).toEqual(['slider1']);
        expect(usedCloudControls(templateById('cloud-doorbell').program)).toEqual([]);
        const parking = templateById('cloud-parking');
        expect(telemetryReadings(parking.connections, parking.program).map(r => r.key)).toEqual(['distance']);
        const heart = templateById('cloud-heart');
        expect(telemetryReadings(heart.connections, heart.program).map(r => r.key)).toEqual(['heartRate']);
    });

    test('doorbell sends an alert from the button', () => {
        const tpl = templateById('cloud-doorbell');
        const code = generateArduino(tpl.connections, tpl.program, {cloud: {deviceId: 'd_abcdefgh23'}});
        expect(code).toContain('cloudAlert("Someone is at the door!");');
    });
});

describe('cloud secrets storage', () => {
    beforeEach(installStorage);

    test('device keys are kept per account', () => {
        writeToken('a@school.org', 'd_abcdefgh23', TOKEN);
        expect(readToken('a@school.org', 'd_abcdefgh23')).toBe(TOKEN);
        expect(readToken('A@School.org', 'd_abcdefgh23')).toBe(TOKEN);
        expect(readToken('b@school.org', 'd_abcdefgh23')).toBeNull();
        expect(readToken('a@school.org', '')).toBeNull();
    });

    test('WiFi stays in the session unless remembered', () => {
        writeWifi('a@x', {ssid: 'Lab', password: 'secret123'}, false);
        expect(window.localStorage.length).toBe(0);
        expect(readWifi('a@x')).toEqual({ssid: 'Lab', password: 'secret123', remember: false});

        writeWifi('a@x', {ssid: 'Home', password: 'secret456'}, true);
        expect(window.sessionStorage.length).toBe(0);
        expect(readWifi('a@x')).toEqual({ssid: 'Home', password: 'secret456', remember: true});
        expect(readWifi('other@x')).toEqual({ssid: '', password: '', remember: false});
    });

    test('readSecrets feeds the upload gate', () => {
        const connections = [{id: 'c1', moduleId: 'cloud', portId: 'ONBOARD', pin: '-'}];
        const cloud = {deviceId: 'd_abcdefgh23', email: 'a@x'};
        expect(cloudUploadProblem(connections, cloud, readSecrets('a@x', cloud.deviceId))).toMatch(/device key/);
        writeToken('a@x', cloud.deviceId, TOKEN);
        expect(cloudUploadProblem(connections, cloud, readSecrets('a@x', cloud.deviceId))).toMatch(/WiFi/);
        writeWifi('a@x', {ssid: 'Lab', password: 'secret123'}, false);
        expect(cloudUploadProblem(connections, cloud, readSecrets('a@x', cloud.deviceId))).toBeNull();
    });

    test('forgetAll only clears the given account', () => {
        writeToken('a@x', 'd_abcdefgh23', TOKEN);
        writeWifi('a@x', {ssid: 'Lab', password: 'secret123'}, true);
        writeLastDevice('a@x', {deviceId: 'd_abcdefgh23', deviceName: 'Lamp', intervalSec: 10});
        writeToken('b@x', 'd_abcdefgh23', TOKEN);
        forgetAll('a@x');
        expect(readToken('a@x', 'd_abcdefgh23')).toBeNull();
        expect(readWifi('a@x').ssid).toBe('');
        expect(readLastDevice('a@x')).toBeNull();
        expect(readToken('b@x', 'd_abcdefgh23')).toBe(TOKEN);
    });

    test('storage failures do not throw', () => {
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get () {
                throw new Error('SecurityError');
            }
        });
        expect(writeToken('a@x', 'd_abcdefgh23', TOKEN)).toBe(false);
        expect(readToken('a@x', 'd_abcdefgh23')).toBeNull();
    });
});

describe('maskSecrets', () => {
    test('hides raw and C-escaped secrets in compiler output', () => {
        const secrets = {token: TOKEN, password: 'pa"ss\\word'};
        const log = `#define CLOUD_TOKEN "${TOKEN}"\n#define CLOUD_WIFI_PASS "pa\\"ss\\\\word"\nplain pa"ss\\word`;
        const out = maskSecrets(log, secrets);
        expect(out).not.toContain(TOKEN);
        expect(out).not.toContain('pa\\"ss');
        expect(out).not.toContain('pa"ss');
        expect(maskSecrets('nothing here', null)).toBe('nothing here');
    });
});
