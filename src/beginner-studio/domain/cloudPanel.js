import {CLOUD_SLIDERS, CLOUD_SWITCHES} from './cloud';
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
 * Dashboard titles in the student's words: reading keys become part names, control keys the
 * names of the Dashboard blocks.
 * @returns {function(string): (string|null)} null for keys this project does not know
 */
const keyTitles = connections => {
    const labels = readingLabels(connections);
    CLOUD_SWITCHES.concat(CLOUD_SLIDERS).forEach(spec => {
        if (!labels[spec.key]) {
            labels[spec.key] = spec.label.replace(/\s*\(.*\)$/, '');
        }
    });
    return key => (Object.prototype.hasOwnProperty.call(labels, key) ? labels[key].slice(0, 40) : null);
};

export {keyTitles, readingLabels};
