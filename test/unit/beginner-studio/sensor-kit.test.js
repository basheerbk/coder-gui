import {MODULE_ART} from '../../../src/beginner-studio/assets/hub';
import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {lockedPortParts} from '../../../src/beginner-studio/domain/cloud';
import {telemetryReadings} from '../../../src/beginner-studio/domain/cloudFirmware';
import {buildSensorOptions} from '../../../src/beginner-studio/domain/condition';
import {moduleById} from '../../../src/beginner-studio/domain/modules';
import {fitsWithCloud, pickPortForModule} from '../../../src/beginner-studio/domain/ports';
import {templateById} from '../../../src/beginner-studio/domain/templates';

const NEW_PARTS = ['ir', 'pir', 'reed', 'ldr', 'flame', 'water', 'buzzer', 'pump', 'solenoid'];
const conn = (id, moduleId, portId, pin) => ({id, moduleId, portId, pin});
const ifBlock = (sensor, children, elseChildren) => ({
    uid: 'if1',
    type: 'if_then',
    params: {sensor, op: 'is', value: 0},
    children: children || [],
    elseChildren: elseChildren || []
});

describe('sensor kit parts', () => {
    test('every new part is in the catalogue, has board art and a jack', () => {
        NEW_PARTS.forEach(id => {
            expect(moduleById(id)).not.toBeNull();
            expect(MODULE_ART[id]).toBeDefined();
            expect(pickPortForModule(moduleById(id), {}, false)).toBe(id === 'water' ? 'A1' : 'D13');
        });
    });

    test('on/off parts work with Cloud; the water sensor needs an A port', () => {
        NEW_PARTS.filter(id => id !== 'water').forEach(id => {
            expect(fitsWithCloud(moduleById(id))).toBe(true);
        });
        expect(fitsWithCloud(moduleById('water'))).toBe(false);
        expect(pickPortForModule(moduleById('water'), {}, false)).toBe('A1');
    });

    test('old aliases now open the real parts', () => {
        expect(moduleById('pir').name).toBe('PIR Motion Sensor');
        expect(moduleById('buzz').id).toBe('buzzer');
    });

    test('active-low sensors read LOW as "detected", the others read HIGH', () => {
        const read = (moduleId, sensor) => generateArduino(
            [conn('s1', moduleId, 'D13', '33')],
            [ifBlock(sensor)]
        );
        expect(read('ir', 'obstacleNear')).toContain('obstacleNear = digitalRead(33) == LOW;');
        expect(read('reed', 'magnetNear')).toContain('magnetNear = digitalRead(33) == LOW;');
        expect(read('flame', 'flameSeen')).toContain('flameSeen = digitalRead(33) == LOW;');
        expect(read('pir', 'motionSeen')).toContain('motionSeen = digitalRead(33) == HIGH;');
        expect(read('ldr', 'isDark')).toContain('isDark = digitalRead(33) == HIGH;');
    });

    test('on/off sensors offer a yes/no condition with a friendly phrase', () => {
        const [option] = buildSensorOptions([conn('s1', 'pir', 'D13', '33')]);
        expect(option).toMatchObject({id: 'motionSeen', boolean: true, label: 'Motion sensor', phrase: 'sees movement'});
    });

    test('buzzer beeps, and pump / lock / buzzer start switched off', () => {
        const code = generateArduino(
            [conn('b1', 'buzzer', 'D13', '33'), conn('p1', 'pump', 'A1', '4'), conn('l1', 'solenoid', 'A2', '15')],
            [{uid: 'bp', type: 'beep', cid: 'b1', params: {ms: 300}}]
        );
        ['33', '4', '15'].forEach(pin => {
            expect(code).toContain(`pinMode(${pin}, OUTPUT);\n  digitalWrite(${pin}, LOW);`);
        });
        expect(code).toContain('digitalWrite(33, HIGH);\n  delay(300);\n  digitalWrite(33, LOW);');
        expect(code).not.toContain('unknown block');
    });

    test('the water sensor averages its analog reading', () => {
        const code = generateArduino(
            [conn('w1', 'water', 'A1', '4')],
            [{uid: 'if1', type: 'if_then', params: {sensor: 'waterLevel', op: '>', value: 1000}, children: [], elseChildren: []}]
        );
        expect(code).toContain('waterLevel = readAnalogAvg(4, 12);');
        expect(code).toContain('if (waterLevel > 1000) {');
    });
});

describe('sensor kit projects', () => {
    test('the door alarm sounds when the magnet moves away', () => {
        const t = templateById('door-alarm');
        const [check] = t.program;
        expect(check.params.sensor).toBe('magnetNear');
        expect(check.children.map(b => [b.type, b.params.on])).toEqual([['set_on', false]]);
        expect(check.elseChildren.map(b => [b.type, b.params.on])).toEqual([['set_on', true]]);
    });

    test('the plant waterer pumps in short bursts', () => {
        const t = templateById('plant-waterer');
        const code = generateArduino(t.connections, t.program);
        expect(code).toContain('if (soilMoisture < 40) {');
        expect(code).toContain('delay(2000);');
        expect(code).toContain('delay(5000);');
    });

    test('Cloud projects with the new parts are valid and send their reading', () => {
        ['cloud-motion', 'cloud-door', 'cloud-pump'].forEach(id => {
            const t = templateById(id);
            expect(t).not.toBeNull();
            expect(lockedPortParts(t.connections)).toEqual([]);
        });
        const motion = templateById('cloud-motion');
        expect(telemetryReadings(motion.connections, motion.program).map(r => r.key)).toEqual(['motionSeen']);
        const door = templateById('cloud-door');
        expect(door.program[0].children).toEqual([]);
        expect(door.program[0].elseChildren[0].type).toBe('cloud_alert');
    });

    test('every new project builds', () => {
        ['doorbell', 'motion-alarm', 'motion-lamp', 'hand-detector', 'hand-gate', 'door-alarm', 'night-light',
            'fire-alarm', 'flood-alarm', 'water-meter', 'plant-waterer', 'card-lock', 'button-lock'].forEach(id => {
            const t = templateById(id);
            expect(t).not.toBeNull();
            expect(generateArduino(t.connections, t.program)).not.toContain('unknown block');
        });
    });
});
