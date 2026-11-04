import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {blockMeta, paletteChipMeta} from '../../../src/beginner-studio/domain/blockMeta';
import {appendBlock} from '../../../src/beginner-studio/domain/tree';
import {buildSensorOptions, buildValueOptions, formatCondition} from '../../../src/beginner-studio/domain/condition';
import {templateById} from '../../../src/beginner-studio/domain/templates';
import {dark} from '../../../src/beginner-studio/domain/tokens';

const conn = (id, moduleId, portId, pin) => ({id, moduleId, portId, pin});
const block = (type, params, extra) => Object.assign({uid: `${type}_1`, type, params: params || {}}, extra);

describe('card reader conditions', () => {
    test('the card reader is a yes/no sensor that reads "Card is tapped"', () => {
        const [card] = buildSensorOptions([conn('r1', 'rfid', 'SPI', '-')]);
        expect(card).toMatchObject({id: 'rfidUid', boolean: true, label: 'Card', phrase: 'is tapped'});
    });

    test('a card condition compiles as a length check, even from an old project with "<"', () => {
        expect(formatCondition({sensor: 'rfidUid', op: 'is', value: 0})).toBe('rfidUid.length() > 0');
        expect(formatCondition({sensor: 'rfidUid', op: '<', value: 500})).toBe('rfidUid.length() > 0');
    });

    test('Card Door only unlocks when a card is tapped, and forgets the card afterwards', () => {
        const tpl = templateById('rfid-door');
        const full = generateArduino(tpl.connections, tpl.program);
        const code = full.slice(full.indexOf('void loop'));
        const check = code.indexOf('if (rfidUid.length() > 0) {');
        expect(check).toBeGreaterThan(-1);
        expect(code.indexOf('PICC_IsNewCardPresent')).toBeLessThan(check);
        expect(code.indexOf('.write(90);')).toBeGreaterThan(check);
        expect(code).toContain('.write(0);');
        expect(code).toMatch(/\} else \{\s*rfidUid = "";/);
    });
});

describe('number settings', () => {
    const servo = [conn('s1', 'servo', 'D5', '25')];

    test('a servo set to 0 degrees really goes to 0', () => {
        expect(generateArduino(servo, [block('set_angle', {angle: 0}, {cid: 's1'})])).toContain('.write(0);');
    });

    test('angles outside 0–180 are clamped', () => {
        expect(generateArduino(servo, [block('set_angle', {angle: 500}, {cid: 's1'})])).toContain('.write(180);');
    });

    test('a negative wait does not become a 49-day delay; an empty one waits 1 second', () => {
        expect(generateArduino([], [block('wait', {seconds: -2})])).toContain('delay(0);');
        expect(generateArduino([], [block('wait', {seconds: ''})])).toContain('delay(1000);');
    });

    test('repeat counts are whole numbers within range', () => {
        expect(generateArduino([], [block('repeat', {count: 2.6}, {children: []})])).toContain('i < 3;');
        expect(generateArduino([], [block('repeat', {count: 99999}, {children: []})])).toContain('i < 1000;');
    });
});

describe('text and values are always valid code', () => {
    test('quotes and backslashes in printed text are escaped', () => {
        const code = generateArduino([], [block('serial_print', {text: 'say "hi" \\o/'})]);
        expect(code).toContain('Serial.println(F("say \\"hi\\" \\\\o/"));');
    });

    test('printing a value that does not exist is skipped instead of breaking the upload', () => {
        const code = generateArduino([], [block('serial_var', {varName: 'value'})]);
        expect(code).not.toContain('Serial.println(value);');
        expect(code).toContain('pick a value');
    });

    test('an If whose sensor was unplugged never runs instead of failing to compile', () => {
        const wires = [conn('l1', 'led', 'D5', '25')];
        const program = [block('if_then', {sensor: 'distance', op: '<', value: 20}, {children: [], elseChildren: []})];
        expect(generateArduino(wires, program)).toContain('if (false) {');
    });

    test('Bluetooth messages can be shown as a value', () => {
        const ids = buildValueOptions([conn('h1', 'hc05', 'UART', '-')]).map(o => o.id);
        expect(ids).toContain('hc05Line');
    });
});

describe('adding blocks', () => {
    test('a block added into an If that was deleted lands at the end instead of vanishing', () => {
        const program = [block('wait', {seconds: 1})];
        const next = appendBlock(program, block('set_on', {on: true}), {parentId: 'gone', branch: 'children'});
        expect(next.map(b => b.type)).toEqual(['wait', 'set_on']);
    });

    test('palette chips use the same words as the placed block', () => {
        expect(paletteChipMeta('set_on', {moduleId: 'relay'}).label).toBe('Turn relay on or off');
        expect(paletteChipMeta('print_soil', {moduleId: 'soil'}).label).toBe('Write soil moisture');
        expect(paletteChipMeta('wait').label).toBe('Wait');
    });
});

describe('block colours', () => {
    test('Wait stands out from the If around it, and no part reuses the control orange', () => {
        const ifMeta = blockMeta(block('if_then'), [], dark);
        const waitMeta = blockMeta(block('wait'), [], dark);
        expect(waitMeta.color).not.toBe(ifMeta.color);
        const relay = blockMeta(block('set_on', {}, {cid: 'r1'}), [conn('r1', 'relay', 'D5', '25')], dark);
        expect(relay.color).not.toBe(ifMeta.color);
        expect(relay.partName).toBe('relay');
    });
});
