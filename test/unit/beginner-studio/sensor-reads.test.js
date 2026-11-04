import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {telemetryReadings} from '../../../src/beginner-studio/domain/cloudFirmware';
import {SILENT_READS, walkBlocks} from '../../../src/beginner-studio/domain/sensorReads';
import {TEMPLATES, templateById} from '../../../src/beginner-studio/domain/templates';

const conn = (id, moduleId, portId, pin) => ({id, moduleId, portId, pin});
const ifBlock = (params, children) => ({uid: 'if1', type: 'if_then', params, children: children || [], elseChildren: []});
const led = {uid: 'l1', type: 'set_on', cid: 'c2', params: {on: true}};
const count = (text, needle) => text.split(needle).length - 1;

describe('If blocks read their own sensor', () => {
    const wires = [conn('c1', 'btn', 'D13', '33'), conn('c2', 'led', 'D5', '25')];

    test('a button If reads the button right before checking it', () => {
        const code = generateArduino(wires, [ifBlock({sensor: 'buttonState', op: 'is', value: 0}, [led])]);
        const read = code.indexOf('buttonState = digitalRead(33) == LOW;');
        expect(read).toBeGreaterThan(-1);
        expect(read).toBeLessThan(code.indexOf('if (buttonState) {'));
    });

    test('an explicit read block from an older project is not doubled', () => {
        const program = [
            {uid: 'r1', type: 'is_pressed', cid: 'c1', params: {}},
            ifBlock({sensor: 'buttonState', op: 'is', value: 0}, [led])
        ];
        expect(count(generateArduino(wires, program), 'digitalRead(33)')).toBe(1);
    });

    test('a repeat re-reads the sensor on every pass', () => {
        const program = [{
            uid: 'rep',
            type: 'repeat',
            params: {count: 3},
            children: [ifBlock({sensor: 'buttonState', op: 'is', value: 0}, [led])]
        }];
        const code = generateArduino(wires, program);
        expect(code.indexOf('digitalRead(33)')).toBeGreaterThan(code.indexOf('for (int i = 0; i < 3; i++) {'));
    });

    test('showing a value reads it first', () => {
        const program = [{uid: 's1', type: 'serial_var', params: {varName: 'distance'}}];
        const code = generateArduino([conn('u1', 'ultra', 'D5', '25')], program);
        expect(code.indexOf('distance = getDistanceTrigEcho(')).toBeLessThan(code.indexOf('Serial.println(distance);'));
    });

    test('templates no longer carry separate read blocks, but their code still reads', () => {
        TEMPLATES.forEach(t => walkBlocks(t.program, b => {
            expect(SILENT_READS).not.toContain(b.type);
        }));
        const lamp = templateById('button-lamp');
        expect(generateArduino(lamp.connections, lamp.program)).toContain('== LOW;');
    });

    test('Cloud still sends a reading that is only used by an If', () => {
        const wired = [conn('c0', 'cloud', 'ONBOARD', '-'), conn('u1', 'ultra', 'D5', '25')];
        const program = [ifBlock({sensor: 'distance', op: '<', value: 20})];
        expect(telemetryReadings(wired, program).map(r => r.key)).toEqual(['distance']);
    });
});
