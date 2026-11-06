import {cEscape} from '../cText';
import {copyVar} from '../partCopies';
import {walkBlocks} from '../sensorReads';

import {
    AI_VAR,
    MOTION_FEATURES,
    NOTHING,
    UNSURE,
    aiProblem,
    aiSignature,
    featureCount,
    kindProblem,
    sensorInputs
} from './aiKinds';
import {trainModel, usableSamples} from './knn';

/** True when an If block in the program asks the AI. */
const usesAi = program => {
    let found = false;
    walkBlocks(program, block => {
        if (block.type === 'if_then' && block.params && block.params.sensor === AI_VAR) {
            found = true;
        }
    });
    return found;
};

/** A C++ float literal (always with a dot or exponent, so the f suffix is valid). */
const cf = x => {
    let s = String(Number(Number(x).toPrecision(6)));
    if (!/[.e]/.test(s)) {
        s += '.0';
    }
    return `${s}f`;
};

const fixed = x => {
    const s = Number(x).toFixed(4).replace(/\.?0+$/, '');
    return `${s === '-0' ? '0' : s}${s.indexOf('.') === -1 ? '.0' : ''}f`;
};

const motionCapture = () => [
    '// ---- Edge AI: moves from the motion sensor (100 readings a second) ----',
    `#define AI_F ${MOTION_FEATURES}`,
    '#define AI_PRE 20',
    '#define AI_WIN 100',
    '#define AI_START 0.35f',
    'float aiRing[AI_PRE][6];',
    'int aiRingHead = 0;',
    'int aiRingCount = 0;',
    'float aiWin[AI_WIN][6];',
    'float aiPeak = 0;',
    'unsigned long aiNextUs = 0;',
    '',
    '// How hard it is moving: how far from still (1 g), plus how fast it turns.',
    'float aiJolt(const float *v) {',
    '  float g = sqrtf(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);',
    '  float spin = sqrtf(v[3] * v[3] + v[4] * v[4] + v[5] * v[5]);',
    '  return fabsf(g - 1.0f) + spin / 300.0f;',
    '}',
    '',
    '// Waits for the next 10 ms slot.',
    'void aiTick() {',
    '  long wait = (long)(aiNextUs - micros());',
    '  if (wait > 10000 || wait < -20000) {',
    '    aiNextUs = micros();',
    '    wait = 0;',
    '  }',
    '  if (wait >= 1000) delay(wait / 1000);',
    '  wait = (long)(aiNextUs - micros());',
    '  if (wait > 0) delayMicroseconds(wait);',
    '  aiNextUs += 10000;',
    '}',
    '',
    '// Average, spread, lowest and highest of each of the 6 axes over the move.',
    'void aiMotionFeatures(float *f) {',
    '  for (int a = 0; a < 6; a++) {',
    '    float sum = 0, sq = 0, lo = aiWin[0][a], hi = aiWin[0][a];',
    '    for (int i = 0; i < AI_WIN; i++) {',
    '      float x = aiWin[i][a];',
    '      sum += x;',
    '      sq += x * x;',
    '      if (x < lo) lo = x;',
    '      if (x > hi) hi = x;',
    '    }',
    '    float mean = sum / AI_WIN;',
    '    float spread = sq / AI_WIN - mean * mean;',
    '    f[a * 4] = mean;',
    '    f[a * 4 + 1] = sqrtf(spread > 0 ? spread : 0);',
    '    f[a * 4 + 2] = lo;',
    '    f[a * 4 + 3] = hi;',
    '  }',
    '}',
    '',
    '// Waits up to waitMs for a move, then keeps 1 second of it (200 ms from just before it started).',
    '// Returns 1 with the features filled in, 0 if nothing moved in time, -1 if the sensor is missing.',
    'int aiCaptureMotion(float *features, unsigned long waitMs) {',
    '  unsigned long start = millis();',
    '  float v[6];',
    '  for (;;) {',
    '    aiTick();',
    '    if (!mpuRead(v)) {',
    '      aiRingCount = 0;',
    '      return -1;',
    '    }',
    '    float jolt = aiJolt(v);',
    '    if (jolt > aiPeak) aiPeak = jolt;',
    '    memcpy(aiRing[aiRingHead], v, sizeof(v));',
    '    aiRingHead = (aiRingHead + 1) % AI_PRE;',
    '    if (aiRingCount < AI_PRE) aiRingCount++;',
    '    if (aiRingCount == AI_PRE && jolt > AI_START) break;',
    '    if (millis() - start >= waitMs) return 0;',
    '  }',
    '  for (int i = 0; i < AI_PRE; i++) memcpy(aiWin[i], aiRing[(aiRingHead + i) % AI_PRE], sizeof(v));',
    '  for (int i = AI_PRE; i < AI_WIN; i++) {',
    '    aiTick();',
    '    if (!mpuRead(v)) {',
    '      aiRingCount = 0;',
    '      return -1;',
    '    }',
    '    memcpy(aiWin[i], v, sizeof(v));',
    '  }',
    '  aiRingCount = 0;',
    '  aiMotionFeatures(features);',
    '  return 1;',
    '}'
];

/** C++ that puts one reading into v[i] without printing anything. */
const readInto = (input, i) => {
    const {mod, port} = input;
    const pin = port ? port.pin : '0';
    const set = expr => `  v[${i}] = ${expr};`;
    if (mod.id === 'dht') {
        const v = name => copyVar(name, input.conn);
        return [
            `  aiDhtRead(${pin}, &${v('lastDhtMs')}, &${v('temperature')}, &${v('humidity')});`,
            set(input.name)
        ];
    }
    if (mod.id === 'ultra') {
        const echo = port && port.ultra ? port.ultra : null;
        const pins = echo || (port && port.pins && port.pins.length >= 2 ? {trig: port.pins[0], echo: port.pins[1]} : null);
        if (!pins) {
            return [set('400')];
        }
        // No echo means nothing within 4 m.
        return [`  { long d = getDistanceTrigEcho(${pins.trig}, ${pins.echo}); v[${i}] = d < 0 ? 400 : d; }`];
    }
    if (mod.id === 'soil') {
        return [`  { int p = soilRawToPercent(readAnalogAvg(${pin}, 8)); v[${i}] = p < 0 ? 0 : p; }`];
    }
    if (mod.id === 'mic') {
        return [set(`aiSoundSpan(${pin})`)];
    }
    if (mod.id === 'mpu6050') {
        return [set(input.base === 'shakeLevel' ? `(${input.name} < 0 ? 0 : ${input.name})` : input.name)];
    }
    if (mod.signal === 'analog') {
        return [set(`readAnalogAvg(${pin}, 8)`)];
    }
    if ((mod.actions || []).some(a => a.type === 'is_detected')) {
        return [set(`digitalRead(${pin}) == ${mod.activeLow ? 'LOW' : 'HIGH'} ? 1 : 0`)];
    }
    return [set('0')];
};

const sensorsCapture = connections => {
    const inputs = sensorInputs(connections);
    const has = id => inputs.some(i => i.mod.id === id);
    const lines = [
        '// ---- Edge AI: moments your sensors notice ----',
        `#define AI_F ${inputs.length}`,
        ''
    ];
    if (has('dht')) {
        lines.push(
            '// The DHT11 answers at most every 2 seconds; in between keep the last reading.',
            'void aiDhtRead(uint8_t pin, unsigned long *lastMs, float *temp, float *hum) {',
            '  if (*lastMs && millis() - *lastMs < 2000) return;',
            '  float t = 0, h = 0;',
            '  if (sampleDht11(pin, &t, &h)) {',
            '    *temp = t;',
            '    *hum = h;',
            '  }',
            '  *lastMs = millis();',
            '}',
            ''
        );
    }
    if (has('mic')) {
        lines.push(
            '// How loud: the gap between the highest and lowest mic reading over 30 ms.',
            'int aiSoundSpan(int pin) {',
            '  int lo = 4095, hi = 0;',
            '  unsigned long start = millis();',
            '  while (millis() - start < 30) {',
            '    int x = analogRead(pin);',
            '    if (x < lo) lo = x;',
            '    if (x > hi) hi = x;',
            '  }',
            '  return hi - lo;',
            '}',
            ''
        );
    }
    lines.push(`// ${inputs.map((input, i) => `v[${i}] ${input.label}`).join(', ')}`);
    lines.push('void aiReadSensors(float *v) {');
    if (has('mpu6050')) {
        lines.push('  readMotion();');
    }
    inputs.forEach((input, i) => readInto(input, i).forEach(l => lines.push(l)));
    lines.push('}');
    lines.push('');
    lines.push('// Averages 5 readings of every sensor over about a second.');
    lines.push('void aiCaptureSensors(float *f) {');
    lines.push('  float sum[AI_F];');
    lines.push('  for (int i = 0; i < AI_F; i++) sum[i] = 0;');
    lines.push('  for (int r = 0; r < 5; r++) {');
    lines.push('    float v[AI_F];');
    lines.push('    aiReadSensors(v);');
    lines.push('    for (int i = 0; i < AI_F; i++) sum[i] += v[i];');
    lines.push('    delay(150);');
    lines.push('  }');
    lines.push('  for (int i = 0; i < AI_F; i++) f[i] = sum[i] / 5;');
    lines.push('}');
    return lines;
};

const captureFor = (kind, connections) => (kind === 'motion' ? motionCapture() : sensorsCapture(connections));

/**
 * Sketch pieces that stream examples to Edge AI instead of running the student's program.
 * @param {string} kind motion | sensors
 * @param {Array} connections wired parts
 * @returns {{helpers: Array<string>, loop: Array<string>}} C++ lines (loop lines are indented)
 */
const aiRecorderParts = (kind, connections) => {
    const hello = `TBAI1,H,${kind},${aiSignature(kind, connections)},${featureCount(kind, connections)}`;
    const helpers = captureFor(kind, connections).concat([
        '',
        'unsigned long aiHelloMs = 0;',
        '',
        'void aiPrint(const float *f) {',
        '  Serial.print(F("TBAI1,F"));',
        '  for (int i = 0; i < AI_F; i++) {',
        '    Serial.print(\',\');',
        '    Serial.print(f[i], 4);',
        '  }',
        '  Serial.println();',
        '}'
    ]);
    const loop = [
        '  // Edge AI recorder: Studio reads these lines while you teach the AI.',
        '  if (!aiHelloMs || millis() - aiHelloMs >= 2000) {',
        '    aiHelloMs = millis();',
        `    Serial.println(F("${hello}"));`,
        '  }',
        '  float f[AI_F];'
    ];
    if (kind === 'motion') {
        loop.push(
            '  int got = aiCaptureMotion(f, 200);',
            '  if (got < 0) {',
            '    Serial.println(F("TBAI1,E,no_sensor"));',
            '    delay(1000);',
            '    return;',
            '  }',
            '  float level = aiPeak / AI_START * 50;',
            '  aiPeak = 0;',
            '  Serial.print(F("TBAI1,L,"));',
            '  Serial.println((int)(level > 100 ? 100 : level));',
            '  if (got > 0) aiPrint(f);'
        );
    } else {
        loop.push('  aiCaptureSensors(f);', '  aiPrint(f);');
    }
    return {helpers, loop};
};

const modelLines = (things, model, withModel, note) => {
    const lines = [];
    const names = ['Nothing'].concat(things.map(t => t.name));
    lines.push(`const char *const AI_NAMES[] = {${names.map(n => `"${cEscape(n)}"`).join(', ')}};`);
    if (!model || !withModel) {
        lines.push(`// ${note}`);
        lines.push('int aiClassify(const float *f) {');
        lines.push('  (void)f;');
        lines.push('  return AI_NOT_SURE;');
        lines.push('}');
        return lines;
    }
    lines.push(`#define AI_N ${model.X.length}`);
    lines.push(`#define AI_K ${model.k}`);
    lines.push(`const float AI_LIMIT = ${cf(model.limit)};`);
    lines.push(`const float AI_MEAN[AI_F] = {${model.mean.map(cf).join(', ')}};`);
    lines.push(`const float AI_SCALE[AI_F] = {${model.scale.map(cf).join(', ')}};`);
    lines.push('const float AI_X[AI_N][AI_F] = {');
    model.X.forEach((row, n) => {
        lines.push(`  {${row.map(fixed).join(', ')}}${n === model.X.length - 1 ? '' : ','}`);
    });
    lines.push('};');
    lines.push(`const uint8_t AI_Y[AI_N] = {${model.y.join(', ')}};`);
    lines.push(
        '',
        '// The answer of the closest examples (most votes of the 3 nearest), or Not sure when even',
        '// the closest one is far away.',
        'int aiClassify(const float *f) {',
        '  float z[AI_F];',
        '  for (int i = 0; i < AI_F; i++) z[i] = (f[i] - AI_MEAN[i]) * AI_SCALE[i];',
        '  float topD[AI_K];',
        '  int topY[AI_K];',
        '  int found = 0;',
        '  for (int n = 0; n < AI_N; n++) {',
        '    float d = 0;',
        '    for (int i = 0; i < AI_F; i++) {',
        '      float x = AI_X[n][i] - z[i];',
        '      d += x * x;',
        '    }',
        '    if (found < AI_K || d < topD[found - 1]) {',
        '      int at = found < AI_K ? found++ : AI_K - 1;',
        '      while (at > 0 && topD[at - 1] > d) {',
        '        topD[at] = topD[at - 1];',
        '        topY[at] = topY[at - 1];',
        '        at--;',
        '      }',
        '      topD[at] = d;',
        '      topY[at] = AI_Y[n];',
        '    }',
        '  }',
        '  if (sqrtf(topD[0]) > AI_LIMIT) return AI_NOT_SURE;',
        '  int best = topY[0], bestVotes = 0;',
        '  for (int a = 0; a < found; a++) {',
        '    int votes = 0;',
        '    for (int b = 0; b < found; b++) {',
        '      if (topY[b] == topY[a]) votes++;',
        '    }',
        '    if (votes > bestVotes) {',
        '      best = topY[a];',
        '      bestVotes = votes;',
        '    }',
        '  }',
        '  return best;',
        '}'
    );
    return lines;
};

/**
 * Sketch pieces for a program whose If blocks ask the AI.
 * @param {object} options.ai project AI ({kind, things, samples, sig})
 * @param {Array} options.connections wired parts
 * @param {boolean} options.withModel include the learned examples (Upload and Copy); the code
 *   panel leaves them out because they are very long
 * @returns {{helpers: Array<string>, problem: (string|null)}} C++ lines
 */
const aiProgramParts = ({ai, connections, withModel}) => {
    const problem = aiProblem(ai, connections);
    const kind = ai && ai.kind;
    const things = (ai && ai.things) || [];
    const capturable = Boolean(kind) && !kindProblem(kind, connections);
    const helpers = [];
    if (capturable) {
        captureFor(kind, connections).forEach(l => helpers.push(l));
        helpers.push('');
    }
    helpers.push('// ---- Edge AI: what it learned ----');
    helpers.push('#define AI_NOTHING 0');
    helpers.push('#define AI_NOT_SURE 9');
    helpers.push(`int ${AI_VAR} = AI_NOTHING;`);
    const model = problem ? null : trainModel(ai);
    let note = '';
    if (problem) {
        note = `Edge AI is not ready yet: ${problem}`;
    } else {
        const n = usableSamples(ai).length;
        note = `The ${n} recorded examples are added here when you press Upload or Copy.`;
    }
    modelLines(things, model, withModel, note).forEach(l => helpers.push(l));
    helpers.push(
        '',
        'const char *aiName(int answer) {',
        `  if (answer < 0 || answer > ${things.length}) return "Not sure";`,
        '  return AI_NAMES[answer];',
        '}',
        ''
    );
    if (!capturable) {
        helpers.push(
            'void aiAsk() {',
            `  ${AI_VAR} = AI_NOT_SURE;`,
            '  delay(100);',
            '}'
        );
    } else if (kind === 'motion') {
        helpers.push(
            '// Ask the AI: waits up to 2 seconds for a move and names it (Nothing when nothing moved).',
            'void aiAsk() {',
            '  float f[AI_F];',
            '  int got = aiCaptureMotion(f, 2000);',
            '  if (got < 0) {',
            `    ${AI_VAR} = AI_NOTHING;`,
            '    delay(200);',
            '    return;',
            '  }',
            `  ${AI_VAR} = got ? aiClassify(f) : AI_NOTHING;`,
            `  if (${AI_VAR} != AI_NOTHING) {`,
            '    Serial.print(F("Edge AI: "));',
            `    Serial.println(aiName(${AI_VAR}));`,
            '  }',
            '}'
        );
    } else {
        helpers.push(
            '// Ask the AI: reads every sensor for about a second and names the moment.',
            'void aiAsk() {',
            '  float f[AI_F];',
            '  aiCaptureSensors(f);',
            `  int before = ${AI_VAR};`,
            `  ${AI_VAR} = aiClassify(f);`,
            `  if (${AI_VAR} != before) {`,
            '    Serial.print(F("Edge AI: "));',
            `    Serial.println(aiName(${AI_VAR}));`,
            '  }',
            '}'
        );
    }
    return {helpers, problem};
};

/**
 * C++ condition for an If that asks the AI, or null when it names a thing the AI does not know.
 * @param {object} params {sensor: 'aiAnswer', value: thing id | 'nothing' | 'unsure'}
 * @param {object} ai project AI
 */
const aiCondition = (params, ai) => {
    const value = params && params.value;
    if (value === NOTHING) {
        return `${AI_VAR} == AI_NOTHING`;
    }
    if (value === UNSURE) {
        return `${AI_VAR} == AI_NOT_SURE`;
    }
    const at = ((ai && ai.things) || []).findIndex(t => t.id === value);
    return at === -1 ? null : `${AI_VAR} == ${at + 1}`;
};

/** Why a program that asks the AI cannot be uploaded yet, or null. */
const aiUploadProblem = (connections, program, ai) => {
    if (!usesAi(program)) {
        return null;
    }
    const problem = aiProblem(ai, connections);
    if (problem) {
        return problem;
    }
    let stale = false;
    walkBlocks(program, block => {
        if (block.type === 'if_then' && block.params && block.params.sensor === AI_VAR && !aiCondition(block.params, ai)) {
            stale = true;
        }
    });
    return stale ? 'An If block asks the AI about something it does not know any more. Pick another answer in it.' : null;
};

export {AI_VAR, aiCondition, aiProgramParts, aiRecorderParts, aiUploadProblem, usesAi};
