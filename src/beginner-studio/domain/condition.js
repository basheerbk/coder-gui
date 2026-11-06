import {AI_VAR, NOTHING, UNSURE} from './ai/aiKinds';
import {CLOUD_CONTROL_OPTIONS} from './cloud';
import {moduleById} from './modules';
import {copyTag, partValues} from './partCopies';

const COMPARE_OPS = [
    {value: '<', label: '<', words: 'is less than'},
    {value: '>', label: '>', words: 'is more than'},
    {value: '<=', label: '≤', words: 'is at most'},
    {value: '>=', label: '≥', words: 'is at least'},
    {value: '==', label: '=', words: 'is exactly'},
    {value: '!=', label: '≠', words: 'is not'}
];

/** Values that hold text; a condition on them means "something arrived". */
const TEXT_VALUES = {rfidUid: true, hc05Line: true};

/** How each sensor value reads in a block sentence. */
const SENSOR_INFO = {
    buttonState: {label: 'Button', phrase: 'is pressed'},
    rfidUid: {label: 'Card', phrase: 'is tapped'},
    knobValue: {label: 'Knob', hint: '0–4095'},
    gasLevel: {label: 'Gas level', hint: '0–4095'},
    soundLevel: {label: 'Sound level'},
    heartRate: {label: 'Heartbeat', unit: 'bpm'},
    soilMoisture: {label: 'Soil moisture', unit: '%'},
    temperature: {label: 'Temperature', unit: '°C'},
    humidity: {label: 'Humidity', unit: '%'},
    distance: {label: 'Distance', unit: 'cm'},
    hc05Line: {label: 'Bluetooth message'},
    obstacleNear: {label: 'Obstacle sensor', phrase: 'sees something'},
    motionSeen: {label: 'Motion sensor', phrase: 'sees movement'},
    magnetNear: {label: 'Reed switch', phrase: 'feels a magnet'},
    isDark: {label: 'Light sensor', phrase: 'says it is dark'},
    flameSeen: {label: 'Flame sensor', phrase: 'sees a flame'},
    waterLevel: {label: 'Water level', hint: '0–4095'},
    tiltAngle: {label: 'Tilt', unit: '°', hint: '-90 to 90'},
    shakeLevel: {label: 'Shake', hint: '0–100'}
};

const ON_OFF_READS = {is_pressed: true, is_motion: true, is_detected: true};

/** Sensors that only say yes or no (button, motion, magnet, ...). */
const isOnOffSensor = mod => Boolean(mod) && (mod.actions || []).some(a => ON_OFF_READS[a.type]);

const isBooleanModule = mod => isOnOffSensor(mod) || Boolean(mod.valueName && TEXT_VALUES[mod.valueName]);

/** A starting comparison that does something visible with each sensor. */
const SENSOR_DEFAULTS = {
    knobValue: {op: '>', value: 2000},
    soilMoisture: {op: '<', value: 40},
    gasLevel: {op: '>', value: 700},
    soundLevel: {op: '>', value: 600},
    heartRate: {op: '>', value: 60},
    distance: {op: '<', value: 25},
    temperature: {op: '>', value: 30},
    humidity: {op: '>', value: 70},
    waterLevel: {op: '>', value: 1000},
    tiltAngle: {op: '>', value: 30},
    shakeLevel: {op: '>', value: 40}
};

/** `base` is the part's plain variable name; `tag` is " 2" for a second copy of the part. */
const withDefaults = (base, option, tag = '') => {
    const d = SENSOR_DEFAULTS[base];
    const info = SENSOR_INFO[base] || {};
    const friendly = {
        label: info.label ? `${info.label}${tag}` : option.label,
        phrase: info.phrase || (option.boolean ? 'is on' : null),
        unit: info.unit || option.unit || null,
        hint: info.hint || option.hint || null
    };
    const defaults = d ? {defaultOp: d.op, defaultValue: d.value} : {};
    return Object.assign({}, defaults, option, friendly);
};

/**
 * The If option for Edge AI once it knows something: its answers are the things it was
 * taught, Nothing (moves only: no move happened) and Not sure.
 */
const aiOption = ai => {
    const things = (ai && ai.things) || [];
    if (!things.length) {
        return null;
    }
    const choices = things.map(t => ({value: t.id, label: t.name}));
    if (ai.kind !== 'sensors') {
        choices.push({value: NOTHING, label: 'Nothing (no move)'});
    }
    choices.push({value: UNSURE, label: 'Not sure'});
    return {id: AI_VAR, label: 'Edge AI', phrase: 'thinks it is', ai: true, boolean: false, moduleId: 'ai', choices};
};

/**
 * Sensor / value options from wired input modules (and Edge AI when it knows something).
 * @param {Array} connections wired parts
 * @param {object} [ai] project AI
 */
const buildSensorOptions = (connections, ai) => {
    const options = [];
    const seen = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir !== 'in') {
            return;
        }
        const boolean = isBooleanModule(mod);
        const tag = copyTag(c, connections);
        partValues(c).forEach(v => {
            if (seen[v.name]) {
                return;
            }
            seen[v.name] = true;
            options.push(withDefaults(v.base, {
                id: v.name,
                label: v.kind === 'humidity' ? `${mod.name}${tag} · humidity` : `${v.label}${tag}`,
                boolean: v.kind === 'value' ? boolean : false,
                moduleId: mod.id,
                cid: c.id,
                base: v.base
            }, tag));
        });
    });
    const cloud = (connections || []).find(c => {
        const mod = moduleById(c.moduleId);
        return mod && mod.id === 'cloud';
    });
    if (cloud) {
        CLOUD_CONTROL_OPTIONS.forEach(opt => {
            options.push(withDefaults(opt.id, {
                id: opt.id,
                label: opt.label.replace(/\s*\(.*\)$/, ''),
                boolean: opt.boolean,
                defaultValue: opt.defaultValue,
                moduleId: 'cloud',
                hint: opt.boolean ? null : '0–100'
            }));
        });
    }
    const smart = aiOption(ai);
    if (smart) {
        options.push(smart);
    }
    return options;
};

/** Every value a block can show or print: wired sensors, Cloud controls, Bluetooth messages. */
const buildValueOptions = connections => {
    const options = buildSensorOptions(connections);
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir === 'in') {
            return;
        }
        const tag = copyTag(c, connections);
        partValues(c).filter(v => v.kind === 'value' && !options.some(o => o.id === v.name)).forEach(v => {
            options.push(withDefaults(v.base, {id: v.name, label: `${mod.name}${tag}`, moduleId: mod.id, cid: c.id, base: v.base}, tag));
        });
    });
    return options;
};

/** If-block params for one sensor option (or the first wired sensor). */
const ifParamsFor = option => {
    if (!option) {
        return {sensor: '', op: '<', value: 500};
    }
    if (option.ai) {
        return {sensor: option.id, op: 'is', value: option.choices[0].value};
    }
    if (option.boolean) {
        return {sensor: option.id, op: 'is', value: 0};
    }
    return {
        sensor: option.id,
        op: option.defaultOp || '<',
        value: option.defaultValue != null ? option.defaultValue : 500
    };
};

const defaultIfParams = connections => ifParamsFor(buildSensorOptions(connections)[0]);

const formatCondition = params => {
    if (!params) {
        return 'true';
    }
    // Legacy free-text
    if (params.condition && !params.sensor) {
        return params.condition;
    }
    const sensor = params.sensor;
    if (!sensor) {
        return 'true';
    }
    if (TEXT_VALUES[sensor]) {
        return `${sensor}.length() > 0`;
    }
    if (params.op === 'is' || params.boolean) {
        return sensor;
    }
    const op = COMPARE_OPS.some(o => o.value === params.op) ? params.op : '<';
    const value = Number(params.value);
    return `${sensor} ${op} ${Number.isFinite(value) ? value : 0}`;
};

export {
    COMPARE_OPS,
    TEXT_VALUES,
    buildSensorOptions,
    buildValueOptions,
    defaultIfParams,
    formatCondition,
    ifParamsFor,
    isBooleanModule,
    isOnOffSensor
};
