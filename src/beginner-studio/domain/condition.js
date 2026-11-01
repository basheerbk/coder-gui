import {CLOUD_CONTROL_OPTIONS} from './cloud';
import {moduleById} from './modules';

const COMPARE_OPS = [
    {value: '<', label: '<'},
    {value: '>', label: '>'},
    {value: '<=', label: '≤'},
    {value: '>=', label: '≥'},
    {value: '==', label: '='},
    {value: '!=', label: '≠'}
];

const isBooleanModule = mod =>
    (mod.actions || []).some(a => a.type === 'is_pressed' || a.type === 'is_motion');

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
            options.push({
                id: mod.valueName,
                label: mod.name,
                boolean,
                moduleId: mod.id
            });
        }
        if (mod.humidityName && !seen[mod.humidityName]) {
            seen[mod.humidityName] = true;
            options.push({
                id: mod.humidityName,
                label: `${mod.name} · humidity`,
                boolean: false,
                moduleId: mod.id
            });
        }
    });
    const cloud = (connections || []).find(c => {
        const mod = moduleById(c.moduleId);
        return mod && mod.id === 'cloud';
    });
    if (cloud) {
        CLOUD_CONTROL_OPTIONS.forEach(opt => {
            options.push({
                id: opt.id,
                label: opt.label,
                boolean: opt.boolean,
                defaultValue: opt.defaultValue,
                moduleId: 'cloud'
            });
        });
    }
    return options;
};

const defaultIfParams = (connections) => {
    const options = buildSensorOptions(connections);
    const first = options[0];
    if (!first) {
        return {sensor: '', op: '<', value: 500};
    }
    if (first.boolean) {
        return {sensor: first.id, op: 'is', value: 0};
    }
    return {sensor: first.id, op: '<', value: first.defaultValue != null ? first.defaultValue : 500};
};

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
    if (params.op === 'is' || params.boolean) {
        return sensor;
    }
    const op = params.op || '<';
    const value = params.value == null || params.value === '' ? 0 : Number(params.value);
    return `${sensor} ${op} ${value}`;
};

export {COMPARE_OPS, buildSensorOptions, defaultIfParams, formatCondition, isBooleanModule};
