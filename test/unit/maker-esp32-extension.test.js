import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '../../static/extensions/makerEsp32');
const source = name => fs.readFileSync(path.join(DIR, name), 'utf8');

/** Runs an extension file the way the OpenBlock loader does and returns the function it registers. */
const load = (name, fnName, extraGlobals = {}) => {
    const names = Object.keys(extraGlobals);
    // eslint-disable-next-line no-new-func
    const run = new Function('exports', 'module', ...names, `${source(name)}\nreturn ${fnName};`);
    return run({}, undefined, ...names.map(n => extraGlobals[n]));
};

const makeBlockly = () => {
    const Blockly = {Blocks: {}, ScratchMsgs: {locales: {en: {}}}};
    load('translations.js', 'registerBlocksMessages')(Blockly);
    Blockly.Msg = Blockly.ScratchMsgs.locales.en;
    load('blocks.js', 'registerBlocks')(Blockly);
    return Blockly;
};

/** The JSON a block type passes to jsonInit. */
const blockJson = (Blockly, type) => {
    let json = null;
    Blockly.Blocks[type].init.call({jsonInit: j => {
        json = j;
    }, setNextStatement: () => {}});
    return json;
};

const makeArduino = () => {
    const Blockly = {
        Arduino: {
            includes_: {},
            definitions_: {},
            customFunctions_: {},
            setups_: {},
            loops_: {},
            ORDER_ATOMIC: 0,
            ORDER_UNARY_PREFIX: 2,
            ORDER_FUNCTION_CALL: 2,
            ORDER_RELATIONAL: 8,
            ORDER_EQUALITY: 9,
            ORDER_NONE: 99,
            valueToCode: () => ''
        }
    };
    load('pin-map.js', 'undefined', {globalThis: global});
    load('generator.js', 'registerGenerators')(Blockly);
    return Blockly;
};

const fakeBlock = (fields = {}) => ({id: 'blk1', getFieldValue: name => (name in fields ? fields[name] : null)});

/** A complete sketch, assembled in the same order as OpenBlock's Arduino generator. */
const sketch = (A, loopCode) => [
    Object.values(A.includes_).join('\n'),
    Object.values(A.definitions_).join('\n'),
    Object.values(A.customFunctions_).join('\n'),
    `void setup() {\n  ${Object.values(A.setups_).join('\n  ')}\n}`,
    `void loop() {\n${loopCode}}`
].join('\n\n');

const NEW_BLOCKS = [
    'makerEsp32_kitIrObstacle', 'makerEsp32_kitPirMotion', 'makerEsp32_kitReedMagnet', 'makerEsp32_kitLdrDark',
    'makerEsp32_kitFlameSeen', 'makerEsp32_kitReadWater', 'makerEsp32_kitReadTilt', 'makerEsp32_kitReadShake',
    'makerEsp32_kitLedBrightness', 'makerEsp32_kitBuzzerBeep', 'makerEsp32_kitBuzzerTone', 'makerEsp32_kitBuzzerStop',
    'makerEsp32_kitPumpSet', 'makerEsp32_kitLockSet'
];

describe('Maker ESP32 Advanced blocks', () => {
    test('every toolbox block has a shape, a label for each input and a generator', () => {
        const Blockly = makeBlockly();
        const A = makeArduino().Arduino;
        const toolbox = load('toolbox.js', 'registerToolboxs')();
        const types = Array.from(toolbox.matchAll(/<block type="(makerEsp32_\w+)"/g), m => m[1]);
        NEW_BLOCKS.forEach(type => expect(types).toContain(type));
        types.forEach(type => {
            expect(Blockly.Blocks[type]).toBeDefined();
            expect(typeof A[type]).toBe('function');
            const json = blockJson(Blockly, type);
            expect(typeof json.message0).toBe('string');
            const placeholders = (json.message0.match(/%\d/g) || []).length;
            expect([type, placeholders]).toEqual([type, (json.args0 || []).length]);
        });
    });

    test('no block offers the ultrasonic jack as an on/off port', () => {
        const Blockly = makeBlockly();
        const toolbox = load('toolbox.js', 'registerToolboxs')();
        expect(toolbox).not.toMatch(/<field name="PORT">D[45]<\/field>/);
        Object.keys(Blockly.Blocks).forEach(type => {
            const json = blockJson(Blockly, type);
            (json.args0 || []).filter(a => a.name === 'PORT').forEach(arg => {
                const values = arg.options.map(o => o[1]);
                expect([type, values.filter(v => v === 'D4' || v === 'D5')]).toEqual([type, []]);
            });
        });
        expect(blockJson(Blockly, 'makerEsp32_setDigital').args0[0].options.map(o => o[1]))
            .toEqual(['D13', 'A1', 'A2', 'A3', 'A4', '3D']);
    });

    test('old projects that still say D4 or D5 fall back to D13 with a note', () => {
        const B = makeArduino();
        const code = B.Arduino.makerEsp32_setDigital(fakeBlock({PORT: 'D4', STATE: 'HIGH'}));
        expect(code).toBe('digitalWrite(D13_PIN, HIGH);\n');
        expect(B.Arduino.definitions_.makerEsp32_oldPort).toContain('ultrasonic jack');
    });

    test('the ultrasonic block uses the D5 jack pins by name', () => {
        const B = makeArduino();
        expect(B.Arduino.makerEsp32_kitReadDistance()[0]).toBe('getDistanceTrigEcho(ULTRA_TRIG_PIN, ULTRA_ECHO_PIN)');
        const defines = B.Arduino.definitions_.makerEsp32_pins;
        expect(defines).toContain('#define ULTRA_ECHO_PIN 25');
        expect(defines).toContain('#define ULTRA_TRIG_PIN 26');
        expect(B.Arduino.setups_.makerEsp32_ultra).toContain('pinMode(ULTRA_ECHO_PIN, INPUT);');
    });

    test('on/off sensors read the same levels as Beginner Studio', () => {
        const A = makeArduino().Arduino;
        const read = (type, port) => A[type](fakeBlock({PORT: port}))[0];
        expect(read('makerEsp32_kitIrObstacle', 'A2')).toBe('(digitalRead(A2_PIN) == LOW)');
        expect(read('makerEsp32_kitReedMagnet', 'D13')).toBe('(digitalRead(D13_PIN) == LOW)');
        expect(read('makerEsp32_kitFlameSeen', 'D13')).toBe('(digitalRead(D13_PIN) == LOW)');
        expect(read('makerEsp32_kitLdrDark', 'A3')).toBe('(digitalRead(A3_PIN) == HIGH)');
        expect(read('makerEsp32_kitPirMotion', 'A1')).toBe('(digitalRead(A1_PIN) == HIGH)');
        expect(read('makerEsp32_kitReadWater', 'A4')).toBe('readAnalogAvg(A4_PIN, 12)');
        expect(A.setups_['pinMode_A2_PIN']).toBe('pinMode(A2_PIN, INPUT);');
    });

    test('pump, lock and buzzer start off; the MPU6050 starts on the I2C bus', () => {
        const A = makeArduino().Arduino;
        expect(A.makerEsp32_kitPumpSet(fakeBlock({PORT: 'A1', STATE: 'ON'}))).toBe('digitalWrite(A1_PIN, HIGH);\n');
        expect(A.makerEsp32_kitLockSet(fakeBlock({PORT: 'A2', STATE: 'CLOSED'}))).toBe('digitalWrite(A2_PIN, LOW);\n');
        expect(A.setups_.makerEsp32_off_A1_PIN).toBe('digitalWrite(A1_PIN, LOW);');
        expect(A.makerEsp32_kitBuzzerTone(fakeBlock({PORT: 'A3'}))).toBe('tone(A3_PIN, constrain((int)(1000), 31, 20000));\n');
        expect(A.makerEsp32_kitLedBrightness(fakeBlock({PORT: 'D13'}))).toBe('analogWrite(D13_PIN, constrain((int)(128), 0, 255));\n');
        expect(A.makerEsp32_kitReadTilt()[0]).toBe('makerEsp32Tilt()');
        expect(A.makerEsp32_kitReadShake()[0]).toBe('makerEsp32Shake()');
        expect(A.setups_.makerEsp32_i2c).toBe('Wire.begin(SDA_PIN, SCL_PIN);');
        expect(A.setups_.makerEsp32_mpu).toContain('mpuReady = mpuBegin();');
        expect(Object.keys(A.setups_).indexOf('makerEsp32_kit_serial'))
            .toBeLessThan(Object.keys(A.setups_).indexOf('makerEsp32_mpu'));
    });

    test('a sketch using every new block holds together', () => {
        const A = makeArduino().Arduino;
        const value = (type, fields) => `  Serial.println(${A[type](fakeBlock(fields))[0]});\n`;
        const loop = [
            value('makerEsp32_kitIrObstacle', {PORT: 'D13'}),
            value('makerEsp32_kitPirMotion', {PORT: 'A1'}),
            value('makerEsp32_kitReedMagnet', {PORT: 'A2'}),
            value('makerEsp32_kitLdrDark', {PORT: 'A3'}),
            value('makerEsp32_kitFlameSeen', {PORT: 'A4'}),
            value('makerEsp32_kitReadWater', {PORT: 'A1'}),
            value('makerEsp32_kitReadTilt', {}),
            value('makerEsp32_kitReadShake', {}),
            A.makerEsp32_kitLedBrightness(fakeBlock({PORT: 'D13'})),
            A.makerEsp32_kitBuzzerBeep(fakeBlock({PORT: 'A2'})),
            A.makerEsp32_kitBuzzerTone(fakeBlock({PORT: 'A2'})),
            A.makerEsp32_kitBuzzerStop(fakeBlock({PORT: 'A2'})),
            A.makerEsp32_kitPumpSet(fakeBlock({PORT: 'A3', STATE: 'ON'})),
            A.makerEsp32_kitLockSet(fakeBlock({PORT: 'A4', STATE: 'OPEN'}))
        ].join('');
        const code = sketch(A, loop);
        expect(code.match(/bool mpuBegin\(\)/g)).toHaveLength(1);
        expect(code).toContain('#include <Wire.h>');
        expect(code).toContain('Serial.begin(9600);');
        if (process.env.MAKER_SKETCH_OUT) {
            fs.mkdirSync(process.env.MAKER_SKETCH_OUT, {recursive: true});
            fs.writeFileSync(path.join(process.env.MAKER_SKETCH_OUT, `${path.basename(process.env.MAKER_SKETCH_OUT)}.ino`),
                `#include <Arduino.h>\n${code}\n`);
        }
    });
});
