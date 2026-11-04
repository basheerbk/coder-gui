import {KNOWN_UNITS} from '../../iot/format';

import {CLOUD_SLIDERS, CLOUD_SWITCHES} from './cloud';
import {telemetryReadings, usedCloudControls} from './cloudFirmware';
import {moduleById} from './modules';

/** Reading key -> the part name the student sees on the board (soilMoisture -> "Soil Moisture Sensor"). */
const readingLabels = connections => {
    const labels = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod) {
            return;
        }
        if (mod.valueName && !labels[mod.valueName]) {
            labels[mod.valueName] = mod.name;
        }
        if (mod.humidityName && !labels[mod.humidityName]) {
            labels[mod.humidityName] = `${mod.name} humidity`;
        }
    });
    return labels;
};

/**
 * What the Cloud tab shows as readings: only what this program sends, newest value first.
 * @returns {Array<{key, label, unit, value, ts}>} value and ts are null before the first reading
 */
const panelReadings = (connections, program, latest) => {
    const labels = readingLabels(connections);
    return telemetryReadings(connections, program).map(r => {
        const hit = (latest || []).find(l => l.key === r.key);
        return {
            key: r.key,
            label: labels[r.key] || r.key,
            unit: KNOWN_UNITS[r.key] || '',
            value: hit ? hit.value : null,
            ts: hit ? hit.ts : null
        };
    });
};

/**
 * Dashboard switches and sliders this program listens to, with the server's current state.
 * @returns {Array<{key, kind, label, control}>} control is null until the board's controls load
 */
const panelControls = (program, controls) => {
    const specs = CLOUD_SWITCHES.concat(CLOUD_SLIDERS);
    return usedCloudControls(program).map(key => {
        const spec = specs.find(c => c.key === key);
        return {
            key,
            kind: spec && !spec.boolean ? 'slider' : 'switch',
            label: spec ? spec.label.replace(/\s*\(.*\)$/, '') : key,
            control: (controls || []).find(c => c.key === key) || null
        };
    });
};

export {panelControls, panelReadings, readingLabels};
