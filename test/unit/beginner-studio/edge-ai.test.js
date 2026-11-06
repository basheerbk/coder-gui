import {AI_LIMITS, aiProblem, aiSignature, sensorInputs, thingKeys, thingNameProblem} from '../../../src/beginner-studio/domain/ai/aiKinds';
import {aiUploadProblem, usesAi} from '../../../src/beginner-studio/domain/ai/aiFirmware';
import {parseAiLine} from '../../../src/beginner-studio/domain/ai/aiLine';
import {addTake, addThing, cleanAi, removeThing, renameThing, setKind} from '../../../src/beginner-studio/domain/ai/aiState';
import {checkModel, classify, trainModel} from '../../../src/beginner-studio/domain/ai/knn';
import {loadProject, saveProject} from '../../../src/beginner-studio/domain/autosave';
import {keyTitles} from '../../../src/beginner-studio/domain/cloudPanel';
import {telemetryReadings} from '../../../src/beginner-studio/domain/cloudFirmware';
import {generateArduino} from '../../../src/beginner-studio/domain/codegen';
import {buildSensorOptions, ifParamsFor} from '../../../src/beginner-studio/domain/condition';
import {TEMPLATES, templateById} from '../../../src/beginner-studio/domain/templates';

const conn = (id, moduleId, portId, pin) => ({id, moduleId, portId, pin});
const ifBlock = (params, children, elseChildren) => ({
    uid: `if-${params.value}`,
    type: 'if_then',
    params,
    children: children || [],
    elseChildren: elseChildren || []
});
const ledOn = {uid: 'l1', type: 'set_on', cid: 'led', params: {on: true}};
const count = (text, needle) => text.split(needle).length - 1;

/** Same numbers every run. */
const rng = seed => {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
};
const cluster = (rand, center, spread, n) => Array.from({length: n}, () => center.map(c => c + ((rand() - 0.5) * spread)));

const MOTION = [conn('mpu', 'mpu6050', 'I2C', '21'), conn('led', 'led', 'D13', '33')];
const SIG = 'motion:mpu6050';
const WAVE = new Array(24).fill(0).map((_, i) => i % 3);
const CIRCLE = WAVE.map(v => v + 4);

/** A motion AI with two things, two recordings each. */
const taughtMotion = () => {
    const rand = rng(7);
    let ai = setKind(null, 'motion');
    ai = addThing(ai, 'wave', 'Wave');
    ai = addThing(ai, 'circle', 'Circle');
    ai = addTake(ai, 'wave', cluster(rand, WAVE, 1, 10), SIG);
    ai = addTake(ai, 'circle', cluster(rand, CIRCLE, 1, 10), SIG);
    ai = addTake(ai, 'wave', cluster(rand, WAVE, 1, 10), SIG);
    ai = addTake(ai, 'circle', cluster(rand, CIRCLE, 1, 10), SIG);
    return ai;
};

describe('MPU6050 motion sensor', () => {
    test('starts the sensor on the I2C bus and declares its readings', () => {
        const code = generateArduino(MOTION, []);
        expect(code).toContain('#include <Wire.h>');
        expect(code).toContain('Wire.begin(SDA_PIN, SCL_PIN);');
        expect(code).toContain('mpuReady = mpuBegin();');
        expect(code).toContain('int tiltAngle');
        expect(code).toContain('int shakeLevel');
        expect(count(code, 'bool mpuBegin()')).toBe(1);
    });

    test('shares the bus with the screen without starting it twice', () => {
        const code = generateArduino(MOTION.concat([conn('oled', 'oled', 'I2C1', '21')]), []);
        expect(count(code, 'Wire.begin(SDA_PIN, SCL_PIN);')).toBe(1);
        expect(count(code, '#include <Wire.h>')).toBe(1);
    });

    test('an If on the tilt reads the sensor right before checking it', () => {
        const code = generateArduino(MOTION, [ifBlock({sensor: 'tiltAngle', op: '>', value: 30}, [ledOn])]);
        const read = code.indexOf('readMotion();', code.indexOf('void loop()'));
        expect(read).toBeGreaterThan(-1);
        expect(read).toBeLessThan(code.indexOf('if (tiltAngle > 30)'));
    });

    test('Cloud only sends the shake when the sensor answered', () => {
        const wires = [conn('cloud', 'cloud', 'ONBOARD', '-'), MOTION[0]];
        const readings = telemetryReadings(wires, [{uid: 'r', type: 'read_motion', cid: 'mpu', params: {}}]);
        expect(readings.map(r => r.key)).toEqual(['tiltAngle', 'shakeLevel']);
        expect(readings[1].valid).toBe('shakeLevel >= 0');
    });
});

describe('what the AI can learn from', () => {
    test('sensor readings come in a fixed order and skip parts that are not a moment', () => {
        const wires = [
            conn('u', 'ultra', 'D5', '25'),
            conn('d', 'dht', 'D13', '33'),
            conn('b', 'btn', 'A1', '4'),
            conn('r', 'rfid', 'I2C', '21')
        ];
        const names = sensorInputs(wires).map(i => i.name);
        expect(names).toEqual(names.slice().sort());
        expect(names).toContain('distance');
        expect(names).toContain('temperature');
        expect(names).toContain('humidity');
        expect(names).not.toContain('buttonState');
        expect(aiSignature('sensors', wires)).toBe(`sensors:${names.join('+')}`);
        expect(aiSignature('motion', wires)).toBe(SIG);
    });

    test('names are checked kindly', () => {
        const things = [{id: 'a', name: 'Wave'}];
        expect(thingNameProblem('', things)).toMatch(/name/);
        expect(thingNameProblem('wave', things)).toMatch(/already have/);
        expect(thingNameProblem('Wave', things, 'a')).toBeNull();
        expect(thingNameProblem('Not sure', things)).toMatch(/built in/);
        expect(thingNameProblem('x'.repeat(AI_LIMITS.nameMax + 1), things)).toMatch(/Keep the name/);
    });

    test('Cloud keys are unique and safe', () => {
        expect(thingKeys([{name: 'Wave'}, {name: 'wave!'}, {name: '!!!'}])).toEqual(['ai_wave', 'ai_wave_2', 'ai_thing3']);
    });

    test('says what is missing, one step at a time', () => {
        expect(aiProblem(null, MOTION)).toMatch(/pick what the AI should learn/);
        expect(aiProblem(setKind(null, 'motion'), [])).toMatch(/MPU6050/);
        let ai = addThing(setKind(null, 'motion'), 'wave', 'Wave');
        expect(aiProblem(ai, MOTION)).toMatch(/at least 2 things/);
        ai = addThing(ai, 'circle', 'Circle');
        expect(aiProblem(ai, MOTION)).toBe('Record 10 more examples of “Wave” in Edge AI.');
        ai = taughtMotion();
        expect(aiProblem(ai, MOTION)).toBeNull();
        expect(aiProblem(Object.assign({}, ai, {sig: 'motion:other'}), MOTION)).toMatch(/parts changed/);
    });
});

describe('the model', () => {
    test('names moves near what it was taught and is not sure about strange ones', () => {
        const ai = taughtMotion();
        const model = trainModel(ai);
        expect(model.F).toBe(24);
        expect(model.X).toHaveLength(40);
        expect(classify(model, WAVE).thing.name).toBe('Wave');
        expect(classify(model, CIRCLE.map(v => v + 0.2)).thing.name).toBe('Circle');
        const far = classify(model, WAVE.map(v => v + 40));
        expect(far.unsure).toBe(true);
        expect(far.thing).toBeNull();
        expect(classify(model, [1, 2]).unsure).toBe(true);
    });

    test('most of the 3 nearest wins; a three-way tie goes to the nearest', () => {
        let ai = setKind(null, 'sensors');
        ai = addThing(ai, 'a', 'A');
        ai = addThing(ai, 'b', 'B');
        ai = addTake(ai, 'a', [[0]], 'sensors:x');
        ai = addTake(ai, 'b', [[0.1], [0.12]], 'sensors:x');
        const majority = classify(trainModel(ai), [0.01]);
        expect(majority.thing.name).toBe('B');
        expect(majority.votes).toBe(2);

        let three = setKind(null, 'sensors');
        ['A', 'B', 'C'].forEach(n => {
            three = addThing(three, n, n);
        });
        three = addTake(three, 'A', [[0]], 'sensors:x');
        three = addTake(three, 'B', [[1]], 'sensors:x');
        three = addTake(three, 'C', [[2]], 'sensors:x');
        const tie = classify(trainModel(three), [0.95]);
        expect(tie.thing.name).toBe('B');
        expect(tie.votes).toBe(1);
    });

    test('the check answers every example from the other recordings', () => {
        const result = checkModel(taughtMotion());
        expect(result.total).toBe(40);
        expect(result.right).toBe(40);
        expect(result.perThing.wave).toEqual({right: 10 + 10, total: 20, mixedWith: {}});
    });

    test('the check counts look-alikes as mixed up', () => {
        const rand = rng(3);
        let ai = setKind(null, 'motion');
        ai = addThing(ai, 'wave', 'Wave');
        ai = addThing(ai, 'circle', 'Circle');
        ai = addTake(ai, 'wave', cluster(rand, WAVE, 2, 10), SIG);
        ai = addTake(ai, 'circle', cluster(rand, WAVE, 2, 10), SIG);
        const result = checkModel(ai);
        expect(result.right).toBeLessThan(result.total);
        const mixed = Object.keys(result.perThing.wave.mixedWith).concat(Object.keys(result.perThing.circle.mixedWith));
        expect(mixed.length).toBeGreaterThan(0);
    });
});

describe('lines from the recorder sketch', () => {
    test('reads hello, examples, levels and problems', () => {
        expect(parseAiLine('TBAI1,H,motion,motion:mpu6050,24')).toEqual({type: 'hello', kind: 'motion', sig: SIG, n: 24});
        expect(parseAiLine(' TBAI1,F,1.5,-2,0.0001\r')).toEqual({type: 'example', f: [1.5, -2, 0.0001]});
        expect(parseAiLine('TBAI1,L,150')).toEqual({type: 'level', value: 100});
        expect(parseAiLine('TBAI1,E,no_sensor')).toEqual({type: 'error', code: 'no_sensor'});
    });

    test('ignores everything else', () => {
        ['TinkerBit Beginner ready', 'TBAI1,H,sound,sound:mic,3', 'TBAI1,H,motion,motion:mpu6050,0', 'TBAI1,F,',
            'TBAI1,F,1,nan', 'TBAI1,F,1,,2', 'TBAI1,L,x', 'TBAI1,E,Bad Code', ''].forEach(line => {
            expect(parseAiLine(line)).toBeNull();
        });
    });
});

describe('the saved AI', () => {
    test('a recording is one step, rounded and capped', () => {
        let ai = addThing(addThing(setKind(null, 'motion'), 'wave', 'Wave'), 'circle', 'Circle');
        ai = addTake(ai, 'wave', [[0.123456, 1], [2, 3]], SIG);
        expect(ai.samples).toEqual([{thing: 'wave', take: 0, f: [0.1235, 1]}, {thing: 'wave', take: 0, f: [2, 3]}]);
        ai = addTake(ai, 'circle', [[5, 5]], SIG);
        expect(ai.samples[2].take).toBe(1);
        for (let i = 0; i < 5; i++) {
            ai = addTake(ai, 'wave', new Array(AI_LIMITS.takeSize).fill([1, 1]), SIG);
        }
        expect(ai.samples.filter(s => s.thing === 'wave')).toHaveLength(AI_LIMITS.maxExamples);
        expect(addTake(ai, 'wave', [[1, 1]], SIG)).toBe(ai);
        expect(addTake(ai, 'ghost', [[1, 1]], SIG)).toBe(ai);
    });

    test('examples made with other parts replace the old ones', () => {
        let ai = addThing(addThing(setKind(null, 'sensors'), 'a', 'A'), 'b', 'B');
        ai = addTake(ai, 'a', [[1, 2]], 'sensors:distance+light');
        ai = addTake(ai, 'b', [[1, 2, 3]], 'sensors:distance+humidity+temperature');
        expect(ai.samples).toHaveLength(1);
        expect(ai.sig).toBe('sensors:distance+humidity+temperature');
    });

    test('things keep their names when the kind changes, but not their examples', () => {
        const ai = taughtMotion();
        expect(setKind(ai, 'motion')).toBe(ai);
        const sensors = setKind(ai, 'sensors');
        expect(sensors.things.map(t => t.name)).toEqual(['Wave', 'Circle']);
        expect(sensors.samples).toEqual([]);
        expect(renameThing(ai, 'wave', 'circle')).toBe(ai);
        expect(renameThing(ai, 'wave', 'Swish').things[0].name).toBe('Swish');
        const left = removeThing(ai, 'wave');
        expect(left.things).toHaveLength(1);
        expect(left.samples.every(s => s.thing === 'circle')).toBe(true);
        expect(addThing(ai, 'x', 'Nothing')).toBe(ai);
    });

    test('a damaged save keeps only what makes sense', () => {
        expect(cleanAi(null)).toBeNull();
        expect(cleanAi([1])).toBeNull();
        const clean = cleanAi({
            kind: 'telepathy',
            things: [{id: 'a', name: 'A'}, {id: 'a', name: 'Again'}, {id: 'b', name: 'a'}, {id: 'c', name: 'C'}, {name: 'No id'}],
            samples: [
                {thing: 'a', take: 0, f: [1, 2]},
                {thing: 'a', take: 0, f: [1, 2, 3]},
                {thing: 'zz', take: 0, f: [1, 2]},
                {thing: 'c', take: -4, f: [1, NaN]},
                {thing: 'c', take: 'x', f: [3, 4]}
            ],
            sig: 'motion:mpu6050'
        });
        expect(clean.kind).toBeNull();
        expect(clean.things).toEqual([{id: 'a', name: 'A'}, {id: 'c', name: 'C'}]);
        expect(clean.samples).toEqual([{thing: 'a', take: 0, f: [1, 2]}, {thing: 'c', take: 0, f: [3, 4]}]);
    });

    test('is saved with the project, and older saves load without it', () => {
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
                },
                key: i => Object.keys(data)[i],
                get length () {
                    return Object.keys(data).length;
                }
            }
        });
        const ai = taughtMotion();
        expect(saveProject('kid@school.org', {projectName: 'Wand', connections: MOTION, program: [], ai})).toBe(true);
        expect(loadProject('kid@school.org').ai).toEqual(ai);
        expect(saveProject('old@school.org', {projectName: 'Old', connections: [], program: []})).toBe(true);
        expect(loadProject('old@school.org').ai).toBeNull();
    });
});

describe('If the AI thinks it is', () => {
    const ai = taughtMotion();
    const program = [
        ifBlock({sensor: 'aiAnswer', op: 'is', value: 'wave'}, [ledOn]),
        ifBlock({sensor: 'aiAnswer', op: 'is', value: 'circle'}, [ledOn])
    ];

    test('is offered with the taught things, Nothing for moves and Not sure', () => {
        const option = buildSensorOptions(MOTION, ai).find(o => o.id === 'aiAnswer');
        expect(option.choices.map(c => c.label)).toEqual(['Wave', 'Circle', 'Nothing (no move)', 'Not sure']);
        expect(ifParamsFor(option)).toEqual({sensor: 'aiAnswer', op: 'is', value: 'wave'});
        const sensors = buildSensorOptions(MOTION, setKind(ai, 'sensors')).find(o => o.id === 'aiAnswer');
        expect(sensors.choices.map(c => c.label)).not.toContain('Nothing (no move)');
        expect(buildSensorOptions(MOTION, null).some(o => o.id === 'aiAnswer')).toBe(false);
    });

    test('asks the AI once per pass and checks the answer number', () => {
        const code = generateArduino(MOTION, program, {ai});
        expect(usesAi(program)).toBe(true);
        expect(count(code, '  aiAsk();')).toBe(1);
        expect(code.indexOf('aiAsk();', code.indexOf('void loop()'))).toBeLessThan(code.indexOf('if (aiAnswer == 1)'));
        expect(code).toContain('if (aiAnswer == 2)');
        expect(code).toContain('const char *const AI_NAMES[] = {"Nothing", "Wave", "Circle"};');
    });

    test('the learned examples go in only for Upload and Copy', () => {
        const preview = generateArduino(MOTION, program, {ai});
        expect(preview).not.toContain('AI_X[AI_N][AI_F]');
        expect(preview).toContain('The 40 recorded examples are added here when you press Upload or Copy.');
        const upload = generateArduino(MOTION, program, {ai, aiModel: true});
        expect(upload).toContain('#define AI_N 40');
        expect(upload).toContain('const float AI_X[AI_N][AI_F] = {');
        expect(upload.match(/[^.\w]\d+f\b/g) || []).toEqual([]);
    });

    test('an If about a removed thing never runs and blocks Upload', () => {
        const stale = [ifBlock({sensor: 'aiAnswer', op: 'is', value: 'ghost'}, [ledOn])];
        const code = generateArduino(MOTION, stale, {ai});
        expect(code).toContain('if (false) {');
        expect(aiUploadProblem(MOTION, stale, ai)).toMatch(/does not know any more/);
        expect(aiUploadProblem(MOTION, program, ai)).toBeNull();
        expect(aiUploadProblem(MOTION, program, setKind(null, 'motion'))).toMatch(/at least 2 things/);
        expect(aiUploadProblem(MOTION, [], null)).toBeNull();
    });

    test('Nothing and Not sure have their own answers', () => {
        const code = generateArduino(MOTION, [
            ifBlock({sensor: 'aiAnswer', op: 'is', value: 'nothing'}, [ledOn]),
            ifBlock({sensor: 'aiAnswer', op: 'is', value: 'unsure'}, [ledOn])
        ], {ai});
        expect(code).toContain('if (aiAnswer == AI_NOTHING)');
        expect(code).toContain('if (aiAnswer == AI_NOT_SURE)');
    });

    test('Cloud gets one reading per thing, named after it', () => {
        const wires = [conn('cloud', 'cloud', 'ONBOARD', '-')].concat(MOTION);
        const readings = telemetryReadings(wires, program, ai);
        expect(readings.map(r => r.key)).toEqual(['ai_wave', 'ai_circle']);
        expect(readings[1].expr).toBe('(aiAnswer == 2 ? 1 : 0)');
        expect(telemetryReadings(wires, [], ai)).toEqual([]);
        expect(keyTitles(wires, ai)('ai_circle')).toBe('AI: Circle');
        const code = generateArduino(wires, program, {ai, cloud: {deviceId: 'd_abcdefghjk', intervalSec: 5}});
        expect(code).toContain('(double)(aiAnswer == 1 ? 1 : 0)');
    });

    test('the recorder sketch streams examples instead of running the program', () => {
        const code = generateArduino(MOTION, program, {aiRecorder: 'motion'});
        expect(code).toContain('Serial.println(F("TBAI1,H,motion,motion:mpu6050,24"));');
        expect(code).toContain('int got = aiCaptureMotion(f, 200);');
        expect(code).not.toContain('aiAsk');
        const room = [conn('u', 'ultra', 'D5', '25'), conn('d', 'dht', 'D13', '33'), conn('m', 'mic', 'A1', '4')];
        const sensors = generateArduino(room, [], {aiRecorder: 'sensors'});
        expect(sensors).toContain(`TBAI1,H,sensors,${aiSignature('sensors', room)},4`);
        expect(sensors).toContain('aiDhtRead(33, &lastDhtMs, &temperature, &humidity);');
        expect(sensors).toContain('aiSoundSpan(4)');
        expect(sensors).toContain('getDistanceTrigEcho(');
    });
});

describe('Edge AI projects', () => {
    test('come with the things to teach and If blocks that name them', () => {
        ['ai-wand', 'ai-room', 'ai-phone'].forEach(id => {
            const tpl = templateById(id);
            expect(tpl).not.toBeNull();
            const ai = cleanAi(tpl.ai);
            expect(ai.things.length).toBeGreaterThanOrEqual(AI_LIMITS.minThings);
            expect(usesAi(tpl.program)).toBe(true);
            const code = generateArduino(tpl.connections, tpl.program, {ai});
            expect(code).not.toContain('if (false)');
            expect(aiUploadProblem(tpl.connections, tpl.program, ai)).toMatch(/Record 10 more examples/);
        });
        expect(TEMPLATES.filter(t => t.ai)).toHaveLength(3);
    });
});
