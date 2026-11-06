import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import {aiSignature, sensorInputs} from '../../../src/beginner-studio/domain/ai/aiKinds';
import {loadProject, saveProject} from '../../../src/beginner-studio/domain/autosave';
import {blockMeta} from '../../../src/beginner-studio/domain/blockMeta';
import {keyTitles} from '../../../src/beginner-studio/domain/cloudPanel';
import {telemetryReadings} from '../../../src/beginner-studio/domain/cloudFirmware';
import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {buildSensorOptions, ifParamsFor} from '../../../src/beginner-studio/domain/condition';
import {MODULES} from '../../../src/beginner-studio/domain/modules';
import {canRepeat, nextCopyNo, partName} from '../../../src/beginner-studio/domain/partCopies';
import useStudioActions from '../../../src/beginner-studio/hooks/useStudioActions';

jest.mock('../../../src/beginner-studio/domain/sound', () => ({
    playConnect: () => {},
    playDisconnect: () => {},
    playTick: () => {}
}));

const conn = (id, moduleId, portId, pin, n) => Object.assign({id, moduleId, portId, pin}, n ? {n} : {});
const ifOn = (sensor, children) => ({uid: `if-${sensor}`, type: 'if_then', params: {sensor, op: 'is', value: 0}, children, elseChildren: []});
const set = (uid, cid, on) => ({uid, type: 'set_on', cid, params: {on}, children: [], elseChildren: []});

const TWO_BUTTONS = [
    conn('b1', 'btn', 'D13', '33'),
    conn('b2', 'btn', 'A1', '4', 2),
    conn('l1', 'led', 'A2', '15'),
    conn('l2', 'led', 'A3', '2', 2)
];
const TWO_DHT = [conn('d1', 'dht', 'A1', '4'), conn('d2', 'dht', 'A2', '15', 2)];

describe('which parts can repeat', () => {
    test('parts on the shared one-wire and analog jacks; not unique jacks, I2C, radios or onboard', () => {
        const ids = MODULES.filter(canRepeat).map(m => m.id).sort();
        expect(ids).toEqual(['btn', 'buzzer', 'dht', 'flame', 'ir', 'ldr', 'led', 'mic', 'mq2', 'pir', 'pot',
            'pump', 'reed', 'relay', 'servo', 'soil', 'solenoid', 'water'].sort());
    });

    test('copies take the lowest free number and keep it', () => {
        expect(nextCopyNo([], 'btn')).toBe(1);
        expect(nextCopyNo(TWO_BUTTONS, 'btn')).toBe(3);
        expect(nextCopyNo([conn('b2', 'btn', 'A1', '4', 2)], 'btn')).toBe(1);
        expect(partName(TWO_BUTTONS[0], TWO_BUTTONS)).toBe('Push Button 1');
        expect(partName(TWO_BUTTONS[1], TWO_BUTTONS)).toBe('Push Button 2');
        // Button 1 unplugged: Button 2 keeps its name, a lone first copy has no number.
        expect(partName(TWO_BUTTONS[1], TWO_BUTTONS.slice(1))).toBe('Push Button 2');
        expect(partName(TWO_BUTTONS[0], [TWO_BUTTONS[0]])).toBe('Push Button');
    });
});

describe('two of the same part in a program', () => {
    test('each button gets its own reading, If option and starter params', () => {
        const options = buildSensorOptions(TWO_BUTTONS);
        expect(options.map(o => [o.id, o.label, o.cid])).toEqual([
            ['buttonState', 'Button 1', 'b1'],
            ['buttonState2', 'Button 2', 'b2']
        ]);
        expect(options[1].phrase).toBe('is pressed');
        expect(ifParamsFor(options[1])).toEqual({sensor: 'buttonState2', op: 'is', value: 0});
    });

    test('the sketch reads both buttons into separate variables and drives each LED', () => {
        const program = [ifOn('buttonState', [set('a', 'l1', true)]), ifOn('buttonState2', [set('b', 'l2', true)])];
        const code = generateArduino(TWO_BUTTONS, program);
        expect(code).toContain('int buttonState = 0;');
        expect(code).toContain('int buttonState2 = 0;');
        expect(code).toContain('buttonState = digitalRead(33) == LOW;');
        expect(code).toContain('buttonState2 = digitalRead(4) == LOW;');
        expect(code).toContain('if (buttonState) {');
        expect(code).toContain('if (buttonState2) {');
        expect(code).toContain('digitalWrite(15, HIGH);');
        expect(code).toContain('digitalWrite(2, HIGH);');
        expect(code).toContain('Serial.print(F("Push Button 2: "));');
        expect(code).toContain('Serial.print(F("LED 2: "));');
    });

    test('two DHT11s keep their own readings and 2-second timers', () => {
        const options = buildSensorOptions(TWO_DHT);
        expect(options.map(o => [o.id, o.label])).toEqual([
            ['temperature', 'Temperature 1'],
            ['humidity', 'Humidity 1'],
            ['temperature2', 'Temperature 2'],
            ['humidity2', 'Humidity 2']
        ]);
        const program = [{uid: 'i', type: 'if_then', params: {sensor: 'humidity2', op: '>', value: 70}, children: [], elseChildren: []}];
        const code = generateArduino(TWO_DHT, program);
        expect(code).toContain('unsigned long lastDhtMs = 0;');
        expect(code).toContain('unsigned long lastDhtMs2 = 0;');
        expect(code).toContain('float humidity2 = 0;');
        expect(code).toContain('bool dhtOk = sampleDht11(15, &dhtT, &dhtH);');
        expect(code).toContain('lastDhtMs2 = millis();');
        expect(code).toContain('humidity2 = dhtH;');
        expect(code).toContain('if (humidity2 > 70) {');
        // Only the DHT the program uses is read.
        expect(code).not.toContain('sampleDht11(4, &dhtT, &dhtH)');
    });

    test('blocks name their copy and can be pointed at the other one', () => {
        const meta = blockMeta(set('a', 'l2', true), TWO_BUTTONS);
        expect(meta.partName).toBe('LED 2');
        expect(meta.copies).toEqual([{value: 'l1', label: 'LED 1'}, {value: 'l2', label: 'LED 2'}]);
        expect(blockMeta(set('a', 'l1', true), [TWO_BUTTONS[2]]).copies).toBeNull();
    });

    test('Cloud sends each copy as its own reading with its own title', () => {
        const wires = TWO_DHT.slice(0, 1).concat([conn('d2', 'dht', 'D13', '33', 2), conn('c', 'cloud', 'ONBOARD', '-')]);
        const program = [{uid: 'i', type: 'if_then', params: {sensor: 'temperature', op: '>', value: 30}, children: [], elseChildren: []},
            {uid: 'j', type: 'if_then', params: {sensor: 'temperature2', op: '>', value: 30}, children: [], elseChildren: []}];
        expect(telemetryReadings(wires, program).map(r => r.key)).toEqual(['temperature', 'humidity', 'temperature2', 'humidity2']);
        const title = keyTitles(wires, null);
        expect(title('temperature2')).toBe('DHT11 Temp & Humid 2');
        expect(title('humidity2')).toBe('DHT11 Temp & Humid 2 humidity');
    });

    test('Edge AI learns from both copies', () => {
        const inputs = sensorInputs(TWO_DHT);
        expect(inputs.map(i => [i.name, i.label])).toEqual([
            ['humidity', 'DHT11 Temp & Humid 1 humidity'],
            ['humidity2', 'DHT11 Temp & Humid 2 humidity'],
            ['temperature', 'DHT11 Temp & Humid 1'],
            ['temperature2', 'DHT11 Temp & Humid 2']
        ]);
        const code = generateArduino(TWO_DHT, [], {aiRecorder: 'sensors'});
        expect(code).toContain(`TBAI1,H,sensors,${aiSignature('sensors', TWO_DHT)},4`);
        expect(code).toContain('aiDhtRead(4, &lastDhtMs, &temperature, &humidity);');
        expect(code).toContain('aiDhtRead(15, &lastDhtMs2, &temperature2, &humidity2);');
    });

    test('autosave keeps the copy numbers', () => {
        const data = {};
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: k => (k in data ? data[k] : null),
                setItem: (k, v) => {
                    data[k] = String(v);
                },
                removeItem: k => {
                    delete data[k];
                }
            }
        });
        expect(saveProject(null, {projectName: 'Two buttons', connections: TWO_BUTTONS, program: []})).toBe(true);
        expect(loadProject(null).connections.map(c => c.n)).toEqual([undefined, 2, undefined, 2]);
    });
});

describe('plugging in a second copy', () => {
    let root;
    let api;
    const Harness = () => {
        const [state, setState] = useState({connections: [], program: [], selectedModule: null});
        api = {state, actions: useStudioActions(state, setState)};
        return null;
    };
    const plug = (moduleId, portId) => {
        act(() => api.actions.selectModule(moduleId));
        act(() => api.actions.connectToPort(portId));
    };

    beforeEach(() => {
        jest.useFakeTimers();
        root = document.createElement('div');
        act(() => {
            ReactDOM.render(<Harness />, root);
        });
    });

    afterEach(() => {
        act(() => {
            ReactDOM.unmountComponentAtNode(root);
        });
        jest.useRealTimers();
    });

    test('a second button becomes Button 2 with its own If block', () => {
        plug('btn', 'D13');
        plug('btn', 'A1');
        const [first, second] = api.state.connections;
        expect(first.n).toBeUndefined();
        expect(second.n).toBe(2);
        expect(api.state.wireHint).toBe('Push Button 2 added. It has its own blocks and reading.');
        expect(api.state.program.map(b => b.params.sensor)).toEqual(['buttonState', 'buttonState2']);
    });

    test('unplugging Button 1 keeps Button 2, and the next button reuses number 1', () => {
        plug('btn', 'D13');
        plug('btn', 'A1');
        act(() => api.actions.disconnect(api.state.connections[0].id));
        expect(api.state.program.map(b => b.params.sensor)).toEqual(['buttonState', 'buttonState2']);
        plug('btn', 'A2');
        expect(api.state.connections.map(c => c.n || 1)).toEqual([2, 1]);
    });

    test('parts with a jack of their own still stay one each', () => {
        plug('mpu6050', 'I2C');
        act(() => api.actions.selectModule('mpu6050'));
        act(() => api.actions.connectToPort('I2C1'));
        expect(api.state.connections).toHaveLength(1);
        expect(api.state.wireHint).toBe('MPU6050 Motion is already on the board');
    });

    test('a block can be moved to the other LED', () => {
        plug('led', 'D13');
        plug('led', 'A1');
        const block = api.state.program[0];
        act(() => api.actions.setBlockPart(block.uid, api.state.connections[1].id));
        expect(api.state.program[0].cid).toBe(api.state.connections[1].id);
    });
});
