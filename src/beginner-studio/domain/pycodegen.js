import {AI_VAR} from './ai/aiKinds';
import {ARDUINO, MICROPYTHON} from './boardLanguage';
import {CLOUD_DEFAULTS, CLOUD_SLIDERS, CLOUD_SWITCHES, clampInterval, hasCloud} from './cloud';
import {telemetryReadings} from './cloudFirmware';
import {buildValueOptions, COMPARE_OPS, TEXT_VALUES} from './condition';
import {moduleById} from './modules';
import {copyTag, copyVar, partValues} from './partCopies';
import {portById} from './ports';
import {sensorReaders, varsReadBy, varsUsedBy, walkBlocks} from './sensorReads';

/**
 * MicroPython for the same blocks as codegen.js, written against the tinkerbit library
 * (prototypes/micropython/lib). The library owns the pin numbers; the program only names jacks.
 */

/** Library class for each part. */
const PY_CLASS = {
    btn: 'Button',
    pot: 'Pot',
    led: 'Led',
    relay: 'Relay',
    buzzer: 'Buzzer',
    pump: 'Pump',
    solenoid: 'Lock',
    servo: 'Servo',
    l293d: 'Motors',
    relay4: 'Relay4',
    stepper: 'Stepper',
    oled: 'Oled',
    mq2: 'Gas',
    mic: 'Mic',
    soil: 'Soil',
    dht: 'DHT11',
    ultra: 'Ultrasonic',
    ir: 'Obstacle',
    pir: 'Pir',
    reed: 'Reed',
    ldr: 'Light',
    flame: 'Flame',
    water: 'Water',
    mpu6050: 'Motion',
    pulse: 'Heartbeat',
    rfid: 'Rfid',
    ble: 'Ble',
    hc05: 'HC05'
};

const DETECTORS = {ir: true, pir: true, reed: true, ldr: true, flame: true};

/** Parts the MicroPython library cannot run yet, by the name a student sees. */
const NOT_YET_PARTS = {};

const NOT_YET_BLOCKS = {
    ai_ask: 'Edge AI'
};

// Same limit as ble_send in codegen.js (one BLE value).
const BLE_TEXT_MAX = 20;

// print() goes to the REPL at 115200; an HC-05 program moves the shared UART to 9600.
const REPL_BAUD = 115200;
const HC05_BAUD = 9600;

/** Dashboard controls: Arduino keeps them in globals, MicroPython asks tinkerbit.cloud. */
const CLOUD_CONTROL_EXPR = {};
CLOUD_SWITCHES.forEach((c, i) => {
    CLOUD_CONTROL_EXPR[c.id] = `cloud.switch(${i + 1})`;
});
CLOUD_SLIDERS.forEach((c, i) => {
    CLOUD_CONTROL_EXPR[c.id] = `cloud.slider(${i + 1})`;
});

// Same limit as cloud_alert in codegen.js.
const ALERT_MAX = 120;
// tbcloud.set() refuses longer reading names.
const READING_KEY_MAX = 23;

/** Studio port id -> library jack name, where they differ. */
const JACK = {STEPPER: 'ST', ONBOARD: 'ESP'};

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const indent = (level, text) => `${'    '.repeat(level)}${text}`;

const num = (value, fallback, min, max) => {
    const n = Number(value);
    const v = value === '' || value === null || typeof value === 'undefined' || !Number.isFinite(n) ? fallback : n;
    return Math.min(max, Math.max(min, v));
};

// A Python string literal (JSON escapes are valid Python escapes).
const pyStr = text => JSON.stringify(String(text));

// Saved projects are untrusted: a line break inside a # comment would start a line of code.
const commentText = text => String(text).replace(/[^\x20-\x7e]/g, '?')
    .slice(0, 40);

const pyBool = on => (on === false ? 'False' : 'True');

const isComment = line => /^\s*#/.test(line);

// Python needs a statement in every block; comments do not count.
const body = lines => (lines.some(l => !isComment(l)) ? lines : lines.concat([null]));

const partOf = conn => {
    const mod = conn ? moduleById(conn.moduleId) : null;
    return mod && PY_CLASS[mod.id] ? mod : null;
};

const partVar = conn => copyVar(moduleById(conn.moduleId).id, conn);

const makeContext = connections => {
    const connById = {};
    const pyValues = {};
    (connections || []).forEach(c => {
        connById[c.id] = c;
        if (partOf(c)) {
            partValues(c).forEach(v => {
                pyValues[v.name] = v.type;
            });
        }
    });
    const known = {};
    buildValueOptions(connections).forEach(o => {
        known[o.id] = true;
    });
    const cloud = hasCloud(connections);
    const exprs = {};
    if (cloud) {
        Object.keys(CLOUD_CONTROL_EXPR).forEach(name => {
            pyValues[name] = 'int';
            exprs[name] = CLOUD_CONTROL_EXPR[name];
        });
    }
    return {connections: connections || [], connById, pyValues, known, exprs, cloud, notYet: {}};
};

// How the program reads a value: its variable, or a call for a dashboard control.
const ref = (ctx, name) => ctx.exprs[name] || name;

const noteNotYet = (ctx, what, level) => {
    ctx.notYet[what] = true;
    return indent(level, `# Not in MicroPython yet: ${what}`);
};

// A value as text the way Arduino's Serial.print shows it (floats with 2 decimals).
const asText = (ctx, name) => (ctx.pyValues[name] === 'float' ? `"%.2f" % ${name}` : `str(${ref(ctx, name)})`);

// 0-4095 sensor value -> 0-255, like map(constrain(v, 0, 4095), 0, 4095, 0, 255).
const scaled = (ctx, varName, fixed) => (varName && IDENT_RE.test(varName) && ctx.pyValues[varName] ?
    `min(4095, max(0, int(${ref(ctx, varName)}))) * 255 // 4095` :
    String(fixed));

const emitLeaf = (block, ctx, level) => {
    const lines = [];
    const p = block.params || {};
    const add = (text, extra = 0) => lines.push(indent(level + extra, text));
    if (NOT_YET_BLOCKS[block.type]) {
        return [noteNotYet(ctx, NOT_YET_BLOCKS[block.type], level)];
    }
    if (block.type === 'cloud_alert' || block.type === 'cloud_send_now') {
        if (!ctx.cloud) {
            return [indent(level, `# ${block.type}: Cloud is not on the board`)];
        }
        if (block.type === 'cloud_alert') {
            const text = p.text === null || typeof p.text === 'undefined' ? '' : String(p.text);
            add(`cloud.alert(${pyStr(text.slice(0, ALERT_MAX))})`);
        } else {
            add('cloud.send()');
        }
        return lines;
    }
    const conn = block.cid ? ctx.connById[block.cid] : null;
    const rawMod = conn ? moduleById(conn.moduleId) : null;
    if (rawMod && NOT_YET_PARTS[rawMod.id]) {
        return [noteNotYet(ctx, NOT_YET_PARTS[rawMod.id], level)];
    }
    const mod = partOf(conn);
    const obj = mod ? partVar(conn) : null;
    const tag = conn ? copyTag(conn, ctx.connections) : '';
    const label = mod ? `${mod.name}${tag}` : (block.type || 'block');
    const valueVar = fallback => (mod && mod.valueName ? copyVar(mod.valueName, conn) : fallback);
    const say = (msg, valueExpr, extra = 0) => add(typeof valueExpr === 'string' ?
        `print(${pyStr(msg)} + ${valueExpr})` :
        `print(${pyStr(msg)})`, extra);
    const needsPart = ['wait', 'serial_print', 'serial_var'].indexOf(block.type) === -1;
    if (needsPart && !obj) {
        return [indent(level, `# ${commentText(block.type)}: its part is not on the board`)];
    }

    switch (block.type) {
    case 'set_on':
        add(`${obj}.${p.on === false ? 'off' : 'on'}()`);
        say(`${label}: ${p.on === false ? 'OFF' : 'ON'}`);
        break;
    case 'turn_on':
        add(`${obj}.on()`);
        say(`${label}: ON`);
        break;
    case 'turn_off':
        add(`${obj}.off()`);
        say(`${label}: OFF`);
        break;
    case 'blink': {
        const ms = Math.round(num(p.ms, 500, 20, 60000));
        add(`${obj}.on()`);
        add(`time.sleep_ms(${ms})`);
        add(`${obj}.off()`);
        add(`time.sleep_ms(${ms})`);
        say(`${label}: blink ${ms}ms`);
        break;
    }
    case 'set_brightness': {
        const level255 = scaled(ctx, p.brightnessVar, Math.round(num(p.brightness, 128, 0, 255)));
        add(`${obj}.brightness(${level255})`);
        say(`${label}: brightness=`, `str(${level255})`);
        break;
    }
    case 'beep': {
        const ms = Math.round(num(p.ms, 200, 20, 10000));
        add(`${obj}.on()`);
        add(`time.sleep_ms(${ms})`);
        add(`${obj}.off()`);
        say(`${label}: beep ${ms}ms`);
        break;
    }
    case 'play_tone': {
        const freq = Math.round(num(p.freq, 1000, 31, 20000));
        add(`${obj}.tone(${freq})`);
        say(`${label}: tone ${freq}`);
        break;
    }
    case 'stop_tone':
        add(`${obj}.no_tone()`);
        say(`${label}: tone off`);
        break;
    case 'show_text':
        add(`${obj}.show(${pyStr(p.text || '')})`);
        say(`OLED: ${p.text || ''}`);
        break;
    case 'show_number':
        if (!IDENT_RE.test(p.varName || '') || !ctx.pyValues[p.varName]) {
            add('# Show number: pick a value to show');
            break;
        }
        add(`${obj}.show(${asText(ctx, p.varName)})`);
        say(`OLED ${p.varName}=`, asText(ctx, p.varName));
        break;
    case 'set_angle': {
        const angle = Math.round(num(p.angle, 90, 0, 180));
        add(`${obj}.angle(${angle})`);
        say(`${label}: angle=${angle}`);
        break;
    }
    case 'relay_channel': {
        const ch = Math.round(num(p.channel, 1, 1, 4));
        add(`${obj}.channel(${ch}, ${pyBool(p.on)})`);
        say(`Relay CH${ch}: ${p.on === false ? 'OFF' : 'ON'}`);
        break;
    }
    case 'relay_all':
        add(`${obj}.all(${pyBool(p.on)})`);
        say(`Relay ALL: ${p.on === false ? 'OFF' : 'ON'}`);
        break;
    case 'motor_speed': {
        if (mod.id !== 'l293d') {
            add('# Motor speed needs the motor driver on MD');
            break;
        }
        const speed = scaled(ctx, p.speedVar, Math.round(num(p.speed, 0, 0, 255)));
        const channel = (p.motor === 'B' || p.channel === 'B') ? 'B' : 'A';
        const reverse = p.dir === 'backward' || p.reverse === true;
        add(`${obj}.speed("${channel}", ${speed}, forward=${reverse ? 'False' : 'True'})`);
        say(`Motor ${channel} ${reverse ? 'REV' : 'FWD'} spd=`, `str(${speed})`);
        break;
    }
    case 'motor_stop':
        if (mod.id !== 'l293d') {
            add('# Motor stop needs the motor driver on MD');
            break;
        }
        add(`${obj}.stop()`);
        say('Motors: STOP');
        break;
    case 'stepper_move': {
        const rpm = Math.round(num(p.rpm, 12, 1, 60));
        const steps = Math.round(num(p.steps, 100, -10000, 10000));
        add(`${obj}.move(${steps}, ${rpm})`);
        say(`Stepper: ${steps} steps @ ${rpm} RPM`);
        break;
    }
    case 'rfid_read': {
        const v = valueVar('rfidUid');
        add(`${v} = ${obj}.card()`);
        add(`if ${v}:`);
        say('RFID UID=', v, 1);
        add('else:');
        say('RFID: no card', null, 1);
        break;
    }
    case 'ble_advertise': {
        const name = String(p.name || 'TinkerBit');
        add(`${obj}.advertise(${pyStr(name)})`);
        say(`BLE advertising: ${name}`);
        break;
    }
    case 'ble_send': {
        const text = String(p.text || '').slice(0, BLE_TEXT_MAX);
        add(`${obj}.send(${pyStr(text)})`);
        say(`BLE send: ${text}`);
        break;
    }
    case 'hc05_send':
        add(`${obj}.send(${pyStr(p.text || '')})`);
        break;
    case 'hc05_read': {
        // Like the Arduino code, the last message stays in the value until a new one arrives.
        const v = valueVar('hc05Line');
        add(`_line = ${obj}.read_line()`);
        add('if _line is not None:');
        add(`${v} = _line.strip()`, 1);
        say('HC-05 RX=', v, 1);
        add('else:');
        say('HC-05: no data', null, 1);
        break;
    }
    case 'print_gas': {
        const v = valueVar('gasLevel');
        add('time.sleep_ms(400)');
        add(`${v} = ${obj}.read()`);
        say(`Gas level${tag}=`, `str(${v}) + " (0-4095 raw)"`);
        break;
    }
    case 'print_soil':
    case 'read_value':
        if (mod.id === 'soil') {
            const v = valueVar('soilMoisture');
            const jack = JACK[conn.portId] || conn.portId;
            if (block.type === 'print_soil') {
                add('time.sleep_ms(300)');
            }
            add(`_raw = ${obj}.raw()`);
            add(`_pct = ${obj}.percent_from(_raw)`);
            add('if _pct < 0:');
            if (block.type === 'read_value') {
                add(`${v} = 0`, 1);
                say(`Soil FAIL - check the ${jack} cable`, null, 1);
            } else {
                say('Soil FAIL raw=', `str(_raw) + ${pyStr(` - wrong jack or no signal (expect ${jack})`)}`, 1);
            }
            add('else:');
            add(`${v} = _pct`, 1);
            say(`Soil moisture${tag}=`, `str(${v}) + " % (raw=" + str(_raw) + ")"`, 1);
            break;
        }
        if (mod.id === 'pulse') {
            const v = valueVar('heartRate');
            add(`${v} = ${obj}.bpm()`);
            add(`if ${v} < 0:`);
            add(`${v} = 0`, 1);
            say('HW-605 not ready', null, 1);
            add('time.sleep_ms(500)', 1);
            add('else:');
            say('HW-605 BPM=', `str(${v})`, 1);
            break;
        }
        add(`${valueVar('value')} = ${obj}.read()`);
        say(`${label}: `, `str(${valueVar('value')})`);
        break;
    case 'is_pressed': {
        const v = valueVar('buttonState');
        add(`${v} = int(${obj}.pressed())`);
        say(`${label}: `, `("PRESSED" if ${v} else "open")`);
        break;
    }
    case 'read_distance': {
        const v = valueVar('distance');
        add(`${v} = ${obj}.cm()`);
        add(`if ${v} < 0:`);
        say('HC-SR04: No valid echo', null, 1);
        add('else:');
        say('HC-SR04 cm=', `str(${v})`, 1);
        add('time.sleep_ms(100)');
        break;
    }
    case 'read_temp':
    case 'read_humidity':
    case 'print_climate': {
        const t = copyVar('temperature', conn);
        const h = copyVar('humidity', conn);
        const jack = JACK[conn.portId] || conn.portId;
        // The DHT11 cannot answer more often than every 2 s.
        add('time.sleep_ms(2000)');
        add(`_t = ${obj}.temperature()`);
        add(`_h = ${obj}.humidity()`);
        add('if _t < 0:');
        say(`DHT11${tag} failed - check the ${jack} cable and power`, null, 1);
        add('else:');
        add(`${t} = _t`, 1);
        add(`${h} = _h`, 1);
        if (block.type === 'print_climate') {
            say(`Temp${tag}=`, `"%.2f" % ${t} + ${pyStr(` C  Humidity${tag}=`)} + "%.2f" % ${h} + " %"`, 1);
        } else if (block.type === 'read_temp') {
            say(`Temp${tag}=`, `"%.2f" % ${t} + " C"`, 1);
        } else {
            say(`Humidity${tag}=`, `"%.2f" % ${h} + " %"`, 1);
        }
        break;
    }
    case 'read_motion': {
        const tilt = copyVar('tiltAngle', conn);
        const shake = copyVar('shakeLevel', conn);
        add(`${tilt}, ${shake} = ${obj}.read()`);
        say('Motion: tilt=', `str(${tilt}) + " shake=" + str(${shake})`);
        break;
    }
    case 'is_motion':
    case 'is_detected': {
        if (!DETECTORS[mod.id]) {
            add(`# ${commentText(block.type)} needs an on/off sensor`);
            break;
        }
        const v = valueVar('detected');
        add(`${v} = int(${obj}.detected())`);
        say(`${label}: `, `("YES" if ${v} else "no")`);
        break;
    }
    case 'wait':
        add(`time.sleep_ms(${Math.round(num(p.seconds, 1, 0, 3600) * 1000)})`);
        break;
    case 'serial_print':
        add(`print(${pyStr(p.text || '')})`);
        break;
    case 'serial_var':
        if (!IDENT_RE.test(p.varName || '') || !ctx.known[p.varName]) {
            add('# Print value: pick a value to print');
            break;
        }
        if (!ctx.pyValues[p.varName]) {
            lines.push(noteNotYet(ctx, 'that value', level));
            break;
        }
        add(`print(${asText(ctx, p.varName)})`);
        break;
    default:
        add(`# unknown block: ${commentText(block.type)}`);
    }
    return lines;
};

const LEGACY_TOKEN = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|[<>!()])/y;
const LEGACY_WORDS = {'&&': 'and', '||': 'or', '!': 'not', 'true': 'True', 'false': 'False', 'HIGH': '1', 'LOW': '0'};

// Old projects typed C conditions by hand; only plain comparisons of known values are carried over.
const legacyCondition = (text, ctx) => {
    const out = [];
    LEGACY_TOKEN.lastIndex = 0;
    const src = String(text).trim();
    while (LEGACY_TOKEN.lastIndex < src.length) {
        const m = LEGACY_TOKEN.exec(src);
        if (!m) {
            return null;
        }
        const tok = m[1];
        if (LEGACY_WORDS[tok]) {
            out.push(LEGACY_WORDS[tok]);
        } else if (/^[A-Za-z_]/.test(tok)) {
            if (!ctx.pyValues[tok]) {
                return null;
            }
            out.push(ref(ctx, tok));
        } else {
            out.push(tok);
        }
    }
    if (!out.length) {
        return null;
    }
    return out.join(' ')
        .replace(/\( /g, '(')
        .replace(/ \)/g, ')');
};

// The If condition in Python; {cond: 'False', note} when it cannot be written.
const pyCondition = (params, ctx) => {
    if (!params) {
        return {cond: 'True'};
    }
    if (params.condition && !params.sensor) {
        const cond = legacyCondition(params.condition, ctx);
        return cond ? {cond} : {cond: 'False', note: '# This If has a hand-typed condition MicroPython cannot read'};
    }
    const sensor = params.sensor;
    if (!sensor) {
        return {cond: 'True'};
    }
    if (sensor === AI_VAR) {
        ctx.notYet['Edge AI'] = true;
        return {cond: 'False', note: '# Not in MicroPython yet: Edge AI'};
    }
    if (!IDENT_RE.test(sensor) || !ctx.known[sensor]) {
        return {cond: 'False', note: '# This If uses a sensor that is not on the board any more'};
    }
    if (!ctx.pyValues[sensor]) {
        const gaps = ctx.connections.map(c => moduleById(c.moduleId)).filter(m => m && NOT_YET_PARTS[m.id]);
        const owner = gaps.find(m => m.valueName === sensor) || gaps.find(m => m.id === 'cloud');
        const what = owner ? NOT_YET_PARTS[owner.id] : 'that value';
        ctx.notYet[what] = true;
        return {cond: 'False', note: `# Not in MicroPython yet: ${what}`};
    }
    if (TEXT_VALUES[sensor]) {
        return {cond: `len(${sensor}) > 0`};
    }
    if (params.op === 'is' || params.boolean) {
        return {cond: ref(ctx, sensor)};
    }
    const op = COMPARE_OPS.some(o => o.value === params.op) ? params.op : '<';
    const value = Number(params.value);
    return {cond: `${ref(ctx, sensor)} ${op} ${Number.isFinite(value) ? value : 0}`};
};

const fillBody = (lines, level) => lines.map(l => (l === null ? indent(level, 'pass') : l));

const emitBlocks = (blocks, ctx, level, readers, fresh = {}) => {
    let lines = [];
    const seen = Object.assign({}, fresh);
    (blocks || []).forEach(block => {
        varsUsedBy(block).forEach(v => {
            const reader = readers[v];
            if (!reader || seen[v] || (reader.cid && !ctx.connById[reader.cid])) {
                return;
            }
            lines = lines.concat(emitLeaf({type: reader.type, cid: reader.cid, params: {}}, ctx, level));
            reader.vars.forEach(r => {
                seen[r] = true;
            });
        });
        varsReadBy(block, ctx.connections).forEach(v => {
            seen[v] = true;
        });
        if (block.type === 'repeat') {
            const n = Math.round(num(block.params && block.params.count, 1, 0, 1000));
            lines.push(indent(level, `for _ in range(${n}):`));
            lines = lines.concat(fillBody(body(emitBlocks(block.children, ctx, level + 1, readers, {})), level + 1));
            return;
        }
        if (block.type === 'if_then') {
            const {cond, note} = pyCondition(block.params, ctx);
            if (note) {
                lines.push(indent(level, note));
            }
            lines.push(indent(level, `if ${cond}:`));
            lines = lines.concat(fillBody(body(emitBlocks(block.children, ctx, level + 1, readers, seen)), level + 1));
            const otherwise = emitBlocks(block.elseChildren, ctx, level + 1, readers, seen);
            if (otherwise.length) {
                lines.push(indent(level, 'else:'));
                lines = lines.concat(fillBody(body(otherwise), level + 1));
            }
            return;
        }
        lines = lines.concat(emitLeaf(block, ctx, level));
    });
    return lines;
};

// The name the Arduino code advertises from setup(): the first Turn on Bluetooth block's.
const firstBleName = program => {
    let name = null;
    walkBlocks(program, block => {
        if (name === null && block.type === 'ble_advertise' && block.params && block.params.name) {
            name = String(block.params.name);
        }
    });
    return name || 'TinkerBit';
};

const setupLines = (conn, program) => {
    const mod = partOf(conn);
    if (!mod) {
        return [];
    }
    if (mod.id === 'ble') {
        return [`${partVar(conn)}.advertise(${pyStr(firstBleName(program))})`];
    }
    if (mod.id === 'hc05') {
        return [`print("HC-05 ready on UART at ${HC05_BAUD} baud")`];
    }
    if (mod.id === 'dht') {
        return ['time.sleep_ms(2000)', 'print("DHT11 ready - sampling every 2s")'];
    }
    if (mod.id === 'mq2') {
        return ['print("MQ-2 ready - heater needs ~1 min; values are raw 0-4095, not ppm")'];
    }
    if (mod.id === 'soil') {
        return ['print("Capacitive soil ready - moisture 0-100% (dry=low %, wet=high %)")'];
    }
    if (mod.id === 'pir') {
        return ['print("Motion sensor warming up - it settles after about a minute")'];
    }
    if (mod.id === 'relay4') {
        return ['print("4-ch relay on MD ready (active-LOW)")'];
    }
    return [];
};

// Readings for the dashboard, set after every pass of the loop (Arduino sends its globals once
// the loop ran). A reading that is not valid right now (no echo) is left out with None.
const telemetryLines = (connections, program, ctx) => telemetryReadings(connections, program, null)
    .filter(r => ctx.pyValues[r.key] && r.key.length <= READING_KEY_MAX)
    .map(r => {
        const valid = /^[A-Za-z_][A-Za-z0-9_]* >= 0$/.test(r.valid) ? r.valid : null;
        return indent(1, `cloud.set("${r.key}", ${valid ? `${r.key} if ${valid} else None` : r.key})`);
    });

const build = (connections, program) => {
    const ctx = makeContext(connections);
    const early = [];
    const parts = [];
    const values = [];
    const setup = [];
    ctx.connections.forEach(c => {
        const raw = moduleById(c.moduleId);
        if (raw && NOT_YET_PARTS[raw.id]) {
            ctx.notYet[NOT_YET_PARTS[raw.id]] = true;
            return;
        }
        const mod = partOf(c);
        if (!mod || !portById(c.portId)) {
            return;
        }
        // The HC-05 moves the USB serial line to its baud rate: before anything is printed.
        (mod.id === 'hc05' ? early : parts)
            .push(`${partVar(c)} = tinkerbit.${PY_CLASS[mod.id]}("${JACK[c.portId] || c.portId}")`);
        partValues(c).forEach(v => {
            values.push(`${v.name} = ${v.type === 'String' ? '""' : v.type === 'float' ? '0.0' : '0'}`);
        });
        setupLines(c, program).forEach(l => setup.push(l));
    });
    const loop = fillBody(body(emitBlocks(program, ctx, 1, sensorReaders(connections))), 1);
    if (!(program || []).length) {
        loop.length = 0;
        loop.push(indent(1, '# Add blocks in the Code tab'));
        loop.push(indent(1, 'time.sleep_ms(100)'));
    }
    if (ctx.cloud) {
        // WiFi and the device key come from /config.json, which Studio writes at Upload.
        setup.push('cloud.begin()');
        telemetryLines(connections, program, ctx).forEach(l => loop.push(l));
    }
    const notYet = Object.keys(ctx.notYet);

    const out = [];
    out.push('# Made with TinkerBit Beginner Studio for the Maker ESP32 RJ11 kit (MicroPython preview).');
    out.push('# Runs on TinkerBit MicroPython with the tinkerbit library.');
    if (notYet.length) {
        out.push(`# Not in MicroPython yet: ${notYet.join(', ')}. Those blocks are left out.`);
    }
    out.push('');
    out.push('import time');
    out.push('import tinkerbit');
    if (ctx.cloud) {
        out.push('from tinkerbit import cloud');
    }
    out.push('');
    early.forEach(l => out.push(l));
    out.push('print("TinkerBit Beginner ready")');
    out.push('');
    if (parts.length) {
        parts.forEach(l => out.push(l));
        out.push('');
    }
    if (values.length) {
        values.forEach(l => out.push(l));
        out.push('');
    }
    if (setup.length) {
        setup.forEach(l => out.push(l));
        out.push('');
    }
    out.push('while True:');
    loop.forEach(l => out.push(l));
    out.push('');
    return {code: out.join('\n'), notYet};
};

/**
 * @param {Array} connections wired parts
 * @param {Array} program block tree
 * @returns {string} main.py for the board
 */
const generatePython = (connections, program) => build(connections, program).code;

/**
 * Parts and blocks of this project the MicroPython preview leaves out.
 * @param {Array} connections wired parts
 * @param {Array} program block tree
 * @returns {Array<string>} names a student knows ("Edge AI"), empty when it runs all of it
 */
const micropythonGaps = (connections, program) => build(connections, program).notYet;

/**
 * The baud rate the board talks at once this project's main.py runs.
 * @param {Array} connections wired parts
 * @returns {number} 9600 with an HC-05 (it shares the USB serial line), else the REPL's 115200
 */
const micropythonBaud = connections => ((connections || []).some(c => {
    const mod = moduleById(c.moduleId);
    return Boolean(mod && mod.id === 'hc05');
}) ? HC05_BAUD : REPL_BAUD);

/**
 * What the board runs: the Studio's language. A MicroPython project with parts MicroPython
 * does not have yet (micropythonGaps) is not uploaded; there is no Arduino fallback, because
 * flashing Arduino would wipe the board's MicroPython. Teachers switch with ?board=arduino.
 * @param {string} language ARDUINO or MICROPYTHON (boardLanguage.js)
 * @returns {string} ARDUINO or MICROPYTHON
 */
const boardTarget = language => (language === MICROPYTHON ? MICROPYTHON : ARDUINO);

// Parts a student cannot add while the Studio writes MicroPython.
const comingSoonPart = (language, moduleId) => {
    const mod = moduleById(moduleId);
    return language === MICROPYTHON && Boolean(mod && NOT_YET_PARTS[mod.id]);
};

const COMING_SOON = 'Coming soon in MicroPython';

/**
 * Why this project cannot go on a MicroPython board yet, or ''.
 * @param {Array<string>} gaps micropythonGaps of the project
 * @returns {string} a sentence for the Upload button
 */
const comingSoonNote = gaps => (gaps.length ?
    `${gaps.join(', ')} ${gaps.length > 1 ? 'are' : 'is'} coming soon in MicroPython. ` +
    `Remove ${gaps.length > 1 ? 'them' : 'it'} from your project to upload.` :
    '');

/**
 * /config.json for a MicroPython Cloud board (read by tinkerbit.cloud.begin()). Holds the WiFi
 * password and device key: Studio writes it over USB at Upload and never shows or logs it.
 * @param {object} cloud the project's Cloud link (deviceId, intervalSec, ...)
 * @param {{ssid: string, password: string, token: string}} secrets from cloudSecrets.readSecrets
 * @returns {object} the file's contents
 */
const micropythonCloudConfig = (cloud, secrets) => {
    const cfg = Object.assign({}, CLOUD_DEFAULTS, cloud || {});
    const minGap = Math.max(1, Number(cfg.minIntervalSec) || CLOUD_DEFAULTS.minIntervalSec);
    return {
        wifi_ssid: (secrets && secrets.ssid) || cfg.ssid || '',
        wifi_password: (secrets && secrets.password) || '',
        host: cfg.host,
        port: Number(cfg.mqttsPort) || CLOUD_DEFAULTS.mqttsPort,
        ws_path: cfg.wssPath || CLOUD_DEFAULTS.wssPath,
        device_id: cfg.deviceId,
        token: (secrets && secrets.token) || '',
        interval_sec: clampInterval(cfg.intervalSec, minGap),
        min_interval_sec: minGap
    };
};

export {
    COMING_SOON,
    PY_CLASS,
    boardTarget,
    comingSoonNote,
    comingSoonPart,
    generatePython,
    micropythonBaud,
    micropythonCloudConfig,
    micropythonGaps
};
