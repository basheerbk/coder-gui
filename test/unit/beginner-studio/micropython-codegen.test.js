import {ARDUINO, MICROPYTHON, readBoardLanguage} from '../../../src/beginner-studio/domain/boardLanguage';
import {
    boardTarget,
    comingSoonNote,
    comingSoonPart,
    generatePython,
    micropythonCloudConfig,
    micropythonGaps
} from '../../../src/beginner-studio/domain/pycodegen';
import {TEMPLATES, templateById} from '../../../src/beginner-studio/domain/templates';

const conn = (id, moduleId, portId, extra) => Object.assign({id, moduleId, portId, pin: '-'}, extra);
const ifBlock = (params, children, elseChildren) => ({
    uid: 'if1',
    type: 'if_then',
    params,
    children: children || [],
    elseChildren: elseChildren || []
});
const ledOn = {uid: 'l1', type: 'set_on', cid: 'c2', params: {on: true}};
const JACKS = ['D13', '3D', 'D5', 'ST', 'MD', 'I2C', 'I2C1', 'A1', 'A2', 'A3', 'A4', 'UART', 'ESP'];

const memoryStorage = () => {
    const data = {};
    return {
        getItem: k => {
            if (k in data) {
                return data[k];
            }
            return null;
        },
        setItem: (k, v) => {
            data[k] = String(v);
        }
    };
};

describe('board language setting', () => {
    test('MicroPython unless asked for Arduino', () => {
        expect(readBoardLanguage('', memoryStorage())).toBe(MICROPYTHON);
        expect(readBoardLanguage('?board=python', memoryStorage())).toBe(MICROPYTHON);
    });

    test('?board=arduino switches back and is remembered; ?board=micropython switches again', () => {
        const store = memoryStorage();
        expect(readBoardLanguage('?board=arduino', store)).toBe(ARDUINO);
        expect(readBoardLanguage('', store)).toBe(ARDUINO);
        expect(readBoardLanguage('?board=micropython', store)).toBe(MICROPYTHON);
        expect(readBoardLanguage('', store)).toBe(MICROPYTHON);
    });

    test('a browser without storage stays on MicroPython unless the address asks', () => {
        const broken = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            }
        };
        expect(readBoardLanguage('', broken)).toBe(MICROPYTHON);
        expect(readBoardLanguage('?board=arduino', broken)).toBe(ARDUINO);
    });
});

describe('upload target', () => {
    test('MicroPython never falls back to Arduino; parts it lacks are coming soon instead', () => {
        expect(boardTarget(MICROPYTHON)).toBe(MICROPYTHON);
        const rfid = [conn('r', 'rfid', 'I2C')];
        expect(micropythonGaps(rfid, [])).toEqual(['RFID reader']);
        expect(comingSoonNote(['RFID reader'])).toBe('RFID reader is coming soon in MicroPython. ' +
            'Remove it from your project to upload.');
        expect(comingSoonNote(['RFID reader', 'Edge AI']))
            .toMatch(/^RFID reader, Edge AI are coming soon.*Remove them/);
        expect(comingSoonNote([])).toBe('');
    });

    test('only BLE, HC-05, RFID and heartbeat parts are coming soon, and only in MicroPython', () => {
        ['ble', 'hc05', 'rfid', 'pulse'].forEach(id => expect(comingSoonPart(MICROPYTHON, id)).toBe(true));
        ['cloud', 'btn', 'led', 'ultra', 'mpu6050', 'oled'].forEach(id => {
            expect(comingSoonPart(MICROPYTHON, id)).toBe(false);
        });
        expect(comingSoonPart(ARDUINO, 'rfid')).toBe(false);
    });

    test('the Arduino setting always uploads Arduino', () => {
        expect(boardTarget(ARDUINO)).toBe(ARDUINO);
    });
});

describe('MicroPython for every template', () => {
    test('every block is known and parts only name jacks', () => {
        TEMPLATES.forEach(t => {
            const code = generatePython(t.connections, t.program);
            expect(code).not.toMatch(/unknown block/);
            expect(code).not.toMatch(/not on the board/);
            expect(code).not.toMatch(/\bmachine\b|\bPin\(/);
            (code.match(/tinkerbit\.\w+\("([^"]+)"\)/g) || []).forEach(made => {
                expect(JACKS).toContain(made.match(/"([^"]+)"/)[1]);
            });
            expect(code).toMatch(/\nwhile True:\n {4}\S/);
        });
    });

    test('only Edge AI, BLE, HC-05, RFID and heartbeat projects have gaps', () => {
        const allowed = ['Edge AI', 'Bluetooth (BLE)', 'HC-05 Bluetooth', 'RFID reader', 'Heartbeat sensor'];
        expect(TEMPLATES.some(t => t.cloud && micropythonGaps(t.connections, t.program).length === 0)).toBe(true);
        const full = TEMPLATES.filter(t => micropythonGaps(t.connections, t.program).length === 0);
        TEMPLATES.forEach(t => {
            micropythonGaps(t.connections, t.program).forEach(g => expect(allowed).toContain(g));
        });
        expect(full.length).toBeGreaterThan(TEMPLATES.length / 2);
        full.forEach(t => expect(generatePython(t.connections, t.program)).not.toMatch(/Not in MicroPython yet/));
    });

    test('button lamp reads the button, then checks it', () => {
        const t = templateById('button-lamp');
        const code = generatePython(t.connections, t.program);
        expect(code).toContain('btn = tinkerbit.Button("');
        const read = code.indexOf('buttonState = int(btn.pressed())');
        expect(read).toBeGreaterThan(-1);
        expect(read).toBeLessThan(code.indexOf('if buttonState:'));
    });
});

describe('MicroPython blocks', () => {
    const wires = [conn('c1', 'btn', 'D13'), conn('c2', 'led', 'A1')];

    test('an empty program still loops', () => {
        expect(generatePython(wires, []))
            .toMatch(/while True:\n {4}# Add blocks in the Code tab\n {4}time\.sleep_ms\(100\)/);
    });

    test('an If with nothing inside gets pass, and an empty else is left out', () => {
        const code = generatePython(wires, [ifBlock({sensor: 'buttonState', op: 'is', value: 0})]);
        expect(code).toMatch(/if buttonState:\n {8}pass/);
        expect(code).not.toContain('else:');
    });

    test('comparisons, else and repeat', () => {
        const pot = [conn('p1', 'pot', 'A2'), conn('c2', 'led', 'A1')];
        const program = [{
            uid: 'r',
            type: 'repeat',
            params: {count: 3},
            children: [ifBlock({sensor: 'knobValue', op: '>=', value: 2000}, [ledOn], [
                {uid: 'l2', type: 'set_on', cid: 'c2', params: {on: false}}
            ])]
        }];
        const code = generatePython(pot, program);
        expect(code).toContain('for _ in range(3):');
        expect(code).toContain('        knobValue = pot.read()');
        expect(code).toContain('        if knobValue >= 2000:');
        expect(code).toContain('            led.on()');
        expect(code).toContain('        else:');
        expect(code).toContain('            led.off()');
    });

    test('a second copy of a part gets its own names', () => {
        const two = [conn('c1', 'btn', 'D13'), conn('c3', 'btn', 'A2', {n: 2}), conn('c2', 'led', 'A1')];
        const code = generatePython(two, [ifBlock({sensor: 'buttonState2', op: 'is', value: 0}, [ledOn])]);
        expect(code).toContain('btn2 = tinkerbit.Button("A2")');
        expect(code).toContain('buttonState2 = int(btn2.pressed())');
        expect(code).toContain('print("Push Button 2: " + ("PRESSED" if buttonState2 else "open"))');
    });

    test('jack names follow the library (ST, ESP)', () => {
        const code = generatePython([conn('s1', 'stepper', 'STEPPER')], [
            {uid: 's', type: 'stepper_move', cid: 's1', params: {steps: -50, rpm: 99}}
        ]);
        expect(code).toContain('stepper = tinkerbit.Stepper("ST")');
        expect(code).toContain('stepper.move(-50, 60)');
    });

    test('active-low sensors use detected()', () => {
        const code = generatePython([conn('i1', 'ir', 'D13'), conn('c2', 'led', 'A1')], [
            ifBlock({sensor: 'obstacleNear', op: 'is', value: 0}, [ledOn])
        ]);
        expect(code).toContain('ir = tinkerbit.Obstacle("D13")');
        expect(code).toContain('obstacleNear = int(ir.detected())');
    });

    test('floats print with two decimals like Arduino', () => {
        const code = generatePython([conn('d1', 'dht', 'A1')], [
            {uid: 'v', type: 'serial_var', params: {varName: 'temperature'}}
        ]);
        expect(code).toContain('temperature = 0.0');
        expect(code).toContain('print("%.2f" % temperature)');
    });

    test('a value can drive brightness', () => {
        const code = generatePython([conn('p1', 'pot', 'A2'), conn('c2', 'led', 'A1')], [
            {uid: 'b', type: 'set_brightness', cid: 'c2', params: {brightnessVar: 'knobValue'}}
        ]);
        expect(code).toContain('knobValue = pot.read()');
        expect(code).toContain('led.brightness(min(4095, max(0, int(knobValue))) * 255 // 4095)');
    });

    test('text from the student is a safe Python string', () => {
        const nasty = 'He said "hi"\\\n\'); import os #';
        const code = generatePython(wires, [{uid: 'p', type: 'serial_print', params: {text: nasty}}]);
        expect(code).toContain(`print(${JSON.stringify(nasty)})`);
        expect(code.split('\n').filter(l => l.indexOf('import') === 0)).toEqual(['import time', 'import tinkerbit']);
    });

    test('a tampered block type cannot break out of its comment', () => {
        const code = generatePython(wires, [{uid: 'x', type: 'oops\nimport os', params: {}}]);
        expect(code).toMatch(/ {4}# .*oops\?import os/);
        expect(code.split('\n').filter(l => /^\s*import/.test(l))).toEqual(['import time', 'import tinkerbit']);
    });

    test('hand-typed C conditions carry over only when they are plain comparisons', () => {
        const ir = [conn('c1', 'btn', 'D13'), conn('i1', 'ir', 'A2'), conn('c2', 'led', 'A1')];
        const ok = generatePython(ir, [ifBlock({condition: 'buttonState && !obstacleNear || false'}, [ledOn])]);
        expect(ok).toContain('if buttonState and not obstacleNear or False:');
        const bad = generatePython(ir, [ifBlock({condition: '__import__("os").remove("main.py")'}, [ledOn])]);
        expect(bad).toContain('if False:');
        expect(bad).not.toContain('__import__');
    });

    test('Edge AI and RFID are left out and reported', () => {
        const wired = [conn('r', 'rfid', '3D'), conn('c2', 'led', 'A1')];
        const program = [
            ifBlock({sensor: 'rfidUid', op: 'is', value: 0}, [ledOn]),
            {uid: 'q', type: 'ai_ask', params: {}}
        ];
        const code = generatePython(wired, program);
        expect(micropythonGaps(wired, program).sort()).toEqual(['Edge AI', 'RFID reader']);
        expect(code).not.toMatch(/tinkerbit\.Rfid/);
        expect(code).toContain('# Not in MicroPython yet: RFID reader');
        expect((code.match(/if False:/g) || []).length).toBe(1);
    });
});

describe('MicroPython Cloud', () => {
    const cloudConn = conn('k', 'cloud', 'ONBOARD');
    const ultra = conn('u', 'ultra', 'D13');

    test('Cloud starts after the parts, from /config.json, with no secrets in main.py', () => {
        const code = generatePython([ultra, cloudConn], []);
        expect(micropythonGaps([ultra, cloudConn], [])).toEqual([]);
        expect(code).toContain('from tinkerbit import cloud');
        expect(code.indexOf('ultra = tinkerbit.Ultrasonic("D13")')).toBeLessThan(code.indexOf('cloud.begin()'));
        expect(code.indexOf('cloud.begin()')).toBeLessThan(code.indexOf('while True:'));
        expect(code).not.toMatch(/password|token|wifi_ssid|config\.json/i);
    });

    test('readings the program uses are sent after every pass, invalid ones as None', () => {
        const program = [
            ifBlock({sensor: 'distance', op: '<', value: 20}, [ledOn]),
            ifBlock({sensor: 'buttonState', op: 'is', value: 0}, [ledOn])
        ];
        const code = generatePython([ultra, conn('c1', 'btn', '3D'), conn('c2', 'led', 'D5'), cloudConn], program);
        const loop = code.slice(code.indexOf('while True:'));
        expect(loop).toContain('    cloud.set("distance", distance if distance >= 0 else None)');
        expect(loop).toContain('    cloud.set("buttonState", buttonState)');
        expect(loop.indexOf('if distance < 20:')).toBeLessThan(loop.indexOf('cloud.set("distance"'));
        expect(code).not.toContain('cloud.set("knobValue"');
    });

    test('dashboard switches and sliders are read where the program uses them', () => {
        const program = [
            ifBlock({sensor: 'cloudSwitch2', op: 'is', value: 0}, [ledOn]),
            ifBlock({sensor: 'cloudSlider1', op: '>', value: 50}, [ledOn]),
            {uid: 'v', type: 'serial_var', params: {varName: 'cloudSlider2'}}
        ];
        const code = generatePython([conn('c2', 'led', 'D13'), cloudConn], program);
        expect(code).toContain('if cloud.switch(2):');
        expect(code).toContain('if cloud.slider(1) > 50:');
        expect(code).toContain('print(str(cloud.slider(2)))');
        expect(code).not.toMatch(/\bcloudSwitch2\b|\bcloudSlider1\b/);
    });

    test('alerts are cut to 120 characters and stay safe strings; Send now sends', () => {
        const text = `"); import os #${'x'.repeat(200)}`;
        const code = generatePython([cloudConn], [
            {uid: 'a', type: 'cloud_alert', params: {text}},
            {uid: 's', type: 'cloud_send_now', params: {}}
        ]);
        expect(code).toContain(`cloud.alert(${JSON.stringify(text.slice(0, 120))})`);
        expect(code).toContain('    cloud.send()');
        expect(code.split('\n').filter(l => /^\s*import/.test(l))).toEqual(['import time', 'import tinkerbit']);
    });

    test('Cloud blocks without the Cloud part are left as comments', () => {
        const alert = {uid: 'a', type: 'cloud_alert', params: {text: 'hi'}};
        const code = generatePython([conn('c2', 'led', 'D13')], [alert]);
        expect(code).not.toContain('cloud.');
        expect(code).toContain('# cloud_alert: Cloud is not on the board');
    });

    test('/config.json carries the WiFi, device and timing the board needs', () => {
        const secrets = {ssid: 'SchoolNet', password: 'test-wifi-pass', token: `tbd_${'T'.repeat(43)}`};
        expect(micropythonCloudConfig({deviceId: 'd_abcdefghij', intervalSec: 2}, secrets)).toEqual({
            wifi_ssid: 'SchoolNet',
            wifi_password: 'test-wifi-pass',
            host: 'api.tinkerbit.io',
            port: 8883,
            ws_path: '/mqtt',
            device_id: 'd_abcdefghij',
            token: secrets.token,
            interval_sec: 5,
            min_interval_sec: 5
        });
        expect(micropythonCloudConfig({deviceId: 'd_abcdefghij'}, {ssid: 'Open', token: 't'}).wifi_password).toBe('');
    });
});
