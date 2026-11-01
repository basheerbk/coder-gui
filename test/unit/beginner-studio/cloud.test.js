import {
    cEscape,
    cloudAddProblem,
    cloudUploadProblem,
    validateWifi
} from '../../../src/beginner-studio/domain/cloud';
import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {buildSensorOptions, defaultIfParams} from '../../../src/beginner-studio/domain/condition';
import {moduleById} from '../../../src/beginner-studio/domain/modules';
import {
    compatibilityHint,
    fitsWithCloud,
    isPortCompatible,
    pickPortForModule,
    portById,
    portUiState,
    usedPortMap
} from '../../../src/beginner-studio/domain/ports';

const TOKEN = `tbd_${'A'.repeat(43)}`;
const CLOUD = {deviceId: 'd_abcdefgh23', intervalSec: 10};
const conn = (id, moduleId, portId) => ({id, moduleId, portId, pin: (portById(portId) || {}).pin});

const cloudConn = conn('c_cloud', 'cloud', 'ONBOARD');
const ultraConn = conn('c_ultra', 'ultra', 'D5');
const ledConn = conn('c_led', 'led', 'D13');

const program = [
    {uid: 'b1', type: 'read_distance', cid: 'c_ultra', params: {}},
    {
        uid: 'b2',
        type: 'if_then',
        params: {sensor: 'cloudSwitch1', op: 'is', value: 0},
        children: [{uid: 'b3', type: 'set_on', cid: 'c_led', params: {on: true}}],
        elseChildren: [{uid: 'b4', type: 'set_on', cid: 'c_led', params: {on: false}}]
    },
    {uid: 'b5', type: 'cloud_alert', cid: 'c_cloud', params: {text: 'Too "close" \\ now?'}}
];

describe('cEscape', () => {
    test('escapes quotes, backslashes, trigraph starters and non-ASCII as octal', () => {
        expect(cEscape('a"b\\c')).toBe('a\\"b\\\\c');
        expect(cEscape('??=')).toBe('\\?\\?=');
        expect(cEscape('é')).toBe('\\303\\251');
        expect(cEscape('line\nnext')).toBe('line\\012next');
        // An octal escape followed by a digit stays unambiguous (always 3 digits).
        expect(cEscape('\u00011')).toBe('\\0011');
    });
});

describe('validateWifi', () => {
    test('length limits are in bytes', () => {
        expect(validateWifi({ssid: '', password: ''}).ok).toBe(false);
        expect(validateWifi({ssid: 'x'.repeat(33)}).ok).toBe(false);
        expect(validateWifi({ssid: 'é'.repeat(17)}).ok).toBe(false);
        expect(validateWifi({ssid: 'Lab', password: 'short'}).ok).toBe(false);
        expect(validateWifi({ssid: 'Lab', password: 'p'.repeat(64)}).ok).toBe(false);
        expect(validateWifi({ssid: 'Lab', password: ''}).ok).toBe(true);
        expect(validateWifi({ssid: 'Lab', password: 'password1'}).ok).toBe(true);
    });
});

describe('A1–A4 lock while Cloud is wired', () => {
    const soil = moduleById('soil');
    const led = moduleById('led');
    const dht = moduleById('dht');

    test('locked jacks reject every part and explain why', () => {
        expect(isPortCompatible(portById('A1'), soil, {}, false)).toBe(true);
        expect(isPortCompatible(portById('A1'), soil, {}, true)).toBe(false);
        expect(isPortCompatible(portById('A2'), led, {}, true)).toBe(false);
        expect(compatibilityHint(portById('A3'), led, true)).toMatch(/A1–A4 are off while Cloud is on/);
    });

    test('auto-wiring skips A1–A4 and analog-only parts have nowhere to go', () => {
        expect(pickPortForModule(dht, {}, false)).toBe('A1');
        expect(pickPortForModule(dht, {}, true)).toBe('D13');
        expect(pickPortForModule(soil, {}, true)).toBeFalsy();
        expect(fitsWithCloud(soil)).toBe(false);
        ['pot', 'mq2', 'mic'].forEach(id => expect(fitsWithCloud(moduleById(id))).toBe(false));
        expect(fitsWithCloud(led)).toBe(true);
    });

    test('jack UI state marks locked jacks', () => {
        const used = usedPortMap([cloudConn]);
        const state = portUiState(portById('A4'), used, null);
        expect(state.cloudLocked).toBe(true);
        expect(state.dimmed).toBe(true);
        expect(portUiState(portById('D13'), used, null).cloudLocked).toBe(false);
        expect(portUiState(portById('A4'), usedPortMap([]), null).cloudLocked).toBe(false);
    });

    test('adding Cloud is refused while A1–A4 or BLE are in use', () => {
        expect(cloudAddProblem([conn('c1', 'soil', 'A1')])).toMatch(/Unplug Capacitive Soil Moisture from A1 first/);
        expect(cloudAddProblem([conn('c1', 'ble', 'ONBOARD')])).toMatch(/Bluetooth/);
        expect(cloudAddProblem([ledConn, ultraConn])).toBeNull();
    });
});

describe('upload gating', () => {
    const wired = [cloudConn, ledConn];
    const secrets = {ssid: 'Lab', password: 'password1', token: TOKEN};

    test('blocks until device, key and WiFi are ready', () => {
        expect(cloudUploadProblem([ledConn], null, null)).toBeNull();
        expect(cloudUploadProblem(wired, null, secrets)).toMatch(/pick or create a device/);
        expect(cloudUploadProblem(wired, CLOUD, {ssid: 'Lab', token: 'nope'})).toMatch(/device key/);
        expect(cloudUploadProblem(wired, CLOUD, {ssid: '', token: TOKEN})).toMatch(/WiFi name/);
        expect(cloudUploadProblem(wired.concat([conn('c2', 'pot', 'A2')]), CLOUD, secrets)).toMatch(/Unplug Potentiometer/);
        expect(cloudUploadProblem(wired, CLOUD, secrets)).toBeNull();
    });
});

describe('dashboard controls in the If picker', () => {
    test('switches and sliders appear only with Cloud wired', () => {
        expect(buildSensorOptions([ledConn]).some(o => o.id === 'cloudSwitch1')).toBe(false);
        const options = buildSensorOptions([cloudConn, ledConn]);
        expect(options.find(o => o.id === 'cloudSwitch4').boolean).toBe(true);
        expect(options.find(o => o.id === 'cloudSlider2').boolean).toBe(false);
        expect(defaultIfParams([cloudConn])).toEqual({sensor: 'cloudSwitch1', op: 'is', value: 0});
    });
});

describe('Cloud firmware codegen', () => {
    const connections = [cloudConn, ultraConn, ledConn];

    test('masks secrets in the code panel', () => {
        const code = generateArduino(connections, program, {cloud: CLOUD});
        expect(code).toContain('#define CLOUD_TOKEN "********"');
        expect(code).toContain('#define CLOUD_WIFI_PASS "********"');
        expect(code).toContain('#define CLOUD_DEVICE_ID "d_abcdefgh23"');
        expect(code).not.toContain(TOKEN);
    });

    test('upload build embeds escaped secrets', () => {
        const code = generateArduino(connections, program, {
            cloud: CLOUD,
            secrets: {ssid: 'Café "Lab"', password: 'pa\\ss word', token: TOKEN}
        });
        expect(code).toContain(`#define CLOUD_TOKEN "${TOKEN}"`);
        expect(code).toContain('#define CLOUD_WIFI_SSID "Caf\\303\\251 \\"Lab\\""');
        expect(code).toContain('#define CLOUD_WIFI_PASS "pa\\\\ss word"');
    });

    test('supports both ESP32 core config layouts', () => {
        const code = generateArduino(connections, program, {cloud: CLOUD});
        expect(code).toContain('#if ESP_IDF_VERSION_MAJOR >= 5');
        expect(code).toContain('cfg.broker.address.uri = cloudUri;');
        expect(code).toContain('cfg.uri = cloudUri;');
        expect(code).toContain('esp_mqtt_client_subscribe_single');
        expect(code.match(/BEGIN CERTIFICATE/g)).toHaveLength(2);
    });

    test('sends only readings the program measures, with validity checks', () => {
        const code = generateArduino(connections, program, {cloud: CLOUD});
        expect(code).toContain('"distance", (double)distance, true, distance >= 0');
        const noRead = generateArduino(connections, program.slice(1), {cloud: CLOUD});
        expect(noRead).not.toContain('(double)distance');
    });

    test('wires setup, loop, controls and alert blocks', () => {
        const code = generateArduino(connections, program, {cloud: CLOUD});
        expect(code).toContain('  cloudSetup();');
        expect(code).toContain('  cloudLoopDone = true;');
        expect(code).toContain('if (cloudSwitch1) {');
        expect(code).toContain('cloudAlert("Too \\"close\\" \\\\ now\\?");');
        expect(code).not.toContain('BLEDevice::init');
        expect(code).not.toMatch(/#error/);
    });

    test('stale states fail compilation with a readable reason', () => {
        const stale = generateArduino(connections.concat([conn('c_soil', 'soil', 'A1')]), program, {cloud: CLOUD});
        expect(stale).toContain('#error "Unplug Capacitive Soil Moisture from A1: A1-A4 are off while Cloud is on"');
        const notSetUp = generateArduino(connections, program, {});
        expect(notSetUp).toContain('#error "Cloud is not set up yet');
    });

    test('sketches without Cloud are unchanged', () => {
        const code = generateArduino([ledConn], [{uid: 'x', type: 'set_on', cid: 'c_led', params: {on: true}}]);
        expect(code).not.toContain('mqtt_client.h');
        expect(code).not.toContain('cloudLoopDone');
    });
});
