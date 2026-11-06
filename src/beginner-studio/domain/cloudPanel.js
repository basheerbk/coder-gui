import {thingKeys} from './ai/aiKinds';
import {CLOUD_SLIDERS, CLOUD_SWITCHES} from './cloud';
import {copyTag, partName, partValues} from './partCopies';

/** Reading key -> the part name the student sees on the board (soilMoisture -> "Soil Moisture Sensor"). */
const readingLabels = connections => {
    const labels = {};
    (connections || []).forEach(c => {
        const tag = copyTag(c, connections);
        partValues(c).forEach(v => {
            if (!labels[v.name]) {
                labels[v.name] = v.kind === 'humidity' ? `${partName(c, connections)} humidity` : `${v.label}${tag}`;
            }
        });
    });
    return labels;
};

/**
 * Dashboard titles in the student's words: reading keys become part names, control keys the
 * names of the Dashboard blocks, and the AI's readings "AI: <thing>".
 * @param {Array} connections wired parts
 * @param {object} [ai] project AI
 * @returns {function(string): (string|null)} null for keys this project does not know
 */
const keyTitles = (connections, ai) => {
    const labels = readingLabels(connections);
    const things = (ai && ai.things) || [];
    thingKeys(things).forEach((key, i) => {
        labels[key] = `AI: ${things[i].name}`;
    });
    CLOUD_SWITCHES.concat(CLOUD_SLIDERS).forEach(spec => {
        if (!labels[spec.key]) {
            labels[spec.key] = spec.label.replace(/\s*\(.*\)$/, '');
        }
    });
    return key => (Object.prototype.hasOwnProperty.call(labels, key) ? labels[key].slice(0, 40) : null);
};

export {keyTitles, readingLabels};
