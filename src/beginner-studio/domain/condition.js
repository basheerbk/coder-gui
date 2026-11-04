import {CLOUD_CONTROL_OPTIONS} from './cloud';
import {moduleById} from './modules';

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
    hc05Line: {label: 'Bluetooth message'}
};

const isBooleanModule = mod =>
    (mod.actions || []).some(a => a.type === 'is_pressed' || a.type === 'is_motion') ||
    Boolean(mod.valueName && TEXT_VALUES[mod.valueName]);

/** A starting comparison that does something visible with each sensor. */
const SENSOR_DEFAULTS = {
    knobValue: {op: '>', value: 2000},
    soilMoisture: {op: '<', value: 40},
    gasLevel: {op: '>', value: 700},
    soundLevel: {op: '>', value: 600},
    heartRate: {op: '>', value: 60},
    distance: {op: '<', value: 25},
    temperature: {op: '>', value: 30},
    humidity: {op: '>', value: 70}
};

const withDefaults = (id, option) => {
    const d = SENSOR_DEFAULTS[id];
    const info = SENSOR_INFO[id] || {};
    const friendly = {
        label: info.label || option.label,
        phrase: info.phrase || (option.boolean ? 'is on' : null),
        unit: info.unit || option.unit || null,
        hint: info.hint || option.hint || null
    };
    const defaults = d ? {defaultOp: d.op, defaultValue: d.value} : {};
    return Object.assign({}, defaults, option, friendly);
};

/** Sensor / value options from wired input modules. */
const buildSensorOptions = connections => {
    const options = [];
    const seen = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir !== 'in') {
            return;
        }
        const boolean = isBooleanModule(mod);
        if (mod.valueName && !seen[mod.valueName]) {
            seen[mod.valueName] = true;
            options.push(withDefaults(mod.valueName, {
                id: mod.valueName,
                label: mod.name,
                boolean,
                moduleId: mod.id
            }));
        }
        if (mod.humidityName && !seen[mod.humidityName]) {
            seen[mod.humidityName] = true;
            options.push(withDefaults(mod.humidityName, {
                id: mod.humidityName,
                label: `${mod.name} · humidity`,
                boolean: false,
                moduleId: mod.id
            }));
        }
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
    return options;
};

/** Every value a block can show or print: wired sensors, Cloud controls, Bluetooth messages. */
const buildValueOptions = connections => {
    const options = buildSensorOptions(connections);
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (mod && mod.dir !== 'in' && mod.valueName && !options.some(o => o.id === mod.valueName)) {
            options.push(withDefaults(mod.valueName, {id: mod.valueName, label: mod.name, moduleId: mod.id}));
        }
    });
    return options;
};

/** If-block params for one sensor option (or the first wired sensor). */
const ifParamsFor = option => {
    if (!option) {
        return {sensor: '', op: '<', value: 500};
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
    isBooleanModule
};
