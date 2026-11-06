import {moduleById} from '../modules';
import {hasMotionSensor} from '../motionSensor';
import {copyTag, partValues} from '../partCopies';
import {portById} from '../ports';

const AI_LIMITS = {
    minThings: 2,
    maxThings: 4,
    nameMax: 16,
    minExamples: 10,
    maxExamples: 40,
    takeSize: 10
};

/** The sketch variable that holds the AI's last answer; If blocks name it as their sensor. */
const AI_VAR = 'aiAnswer';

/** Answers every AI can give besides the things it was taught. */
const NOTHING = 'nothing';
const UNSURE = 'unsure';

const MOTION_FEATURES = 24;

const AI_KINDS = [
    {
        id: 'motion',
        label: 'Motion',
        event: true,
        blurb: 'Learns moves you make with the motion sensor, like a wave, a shake or a circle.',
        examples: ['Wave', 'Circle']
    },
    {
        id: 'sensors',
        label: 'Sensors',
        event: false,
        blurb: 'Learns moments your sensors notice together, like an empty room or someone at the door.',
        examples: ['Empty', 'Someone here']
    }
];

const kindById = id => AI_KINDS.find(k => k.id === id) || null;

/** Parts whose readings do not describe a moment (a card number, a message, a button press, a pulse). */
const NOT_FOR_SENSORS = {pulse: true, rfid: true, hc05: true, btn: true};

/**
 * Readings the Sensors AI learns from, in a fixed order the board uses too.
 * @param {Array} connections wired parts
 * @returns {Array<{name, base, kind, label, conn, mod, port}>} one entry per reading
 */
const sensorInputs = connections => {
    const inputs = [];
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir !== 'in' || NOT_FOR_SENSORS[mod.id] || mod.valueType === 'String') {
            return;
        }
        const port = portById(c.portId);
        const tag = copyTag(c, connections);
        partValues(c).forEach(v => {
            if (!inputs.some(i => i.name === v.name)) {
                const label = v.kind === 'humidity' ? `${mod.name}${tag} humidity` : `${v.label}${tag}`;
                inputs.push({name: v.name, base: v.base, kind: v.kind, label, conn: c, mod, port});
            }
        });
    });
    return inputs.sort((a, b) => (a.name < b.name ? -1 : 1));
};

const featureCount = (kind, connections) => (kind === 'motion' ? MOTION_FEATURES : sensorInputs(connections).length);

/**
 * Names the parts an AI was taught with. Examples recorded with other parts (or another kind)
 * cannot be mixed in, so a changed signature means "record again".
 */
const aiSignature = (kind, connections) => {
    if (kind === 'motion') {
        return 'motion:mpu6050';
    }
    if (kind === 'sensors') {
        return `sensors:${sensorInputs(connections).map(i => i.name).join('+')}`;
    }
    return '';
};

/** Why this kind of AI cannot be taught with the parts on the board, or null. */
const kindProblem = (kind, connections) => {
    if (kind === 'motion' && !hasMotionSensor(connections)) {
        return 'Plug the MPU6050 motion sensor into I2C first.';
    }
    if (kind === 'sensors' && !sensorInputs(connections).length) {
        return 'Plug in a sensor first, like the distance, light or temperature sensor.';
    }
    if (!kindById(kind)) {
        return 'Pick what the AI should learn.';
    }
    return null;
};

const RESERVED = {nothing: true, 'not sure': true, notsure: true};

/** Why a thing cannot have this name, or null. */
const thingNameProblem = (name, things, selfId) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
        return 'Give it a name.';
    }
    if (trimmed.length > AI_LIMITS.nameMax) {
        return `Keep the name to ${AI_LIMITS.nameMax} letters.`;
    }
    if (RESERVED[trimmed.toLowerCase()]) {
        return `“${trimmed}” is already built in. Pick another name.`;
    }
    const same = (things || []).find(t => t.id !== selfId && t.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (same) {
        return `You already have “${same.name}”.`;
    }
    return null;
};

/** Cloud reading key for a thing: ai_ plus its name in letters, digits and _. */
const thingKeys = things => {
    const used = {};
    return (things || []).map((t, i) => {
        let slug = String(t.name || '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 24) || `thing${i + 1}`;
        if (used[slug]) {
            let n = 2;
            while (used[`${slug}_${n}`]) {
                n++;
            }
            slug = `${slug}_${n}`;
        }
        used[slug] = true;
        return `ai_${slug}`;
    });
};

const countsFor = ai => {
    const counts = {};
    ((ai && ai.things) || []).forEach(t => {
        counts[t.id] = 0;
    });
    ((ai && ai.samples) || []).forEach(s => {
        if (Object.prototype.hasOwnProperty.call(counts, s.thing)) {
            counts[s.thing]++;
        }
    });
    return counts;
};

/**
 * What still stands between this AI and a program that uses it, as one sentence, or null when
 * it is ready to upload.
 */
const aiProblem = (ai, connections) => {
    if (!ai || !ai.kind) {
        return 'Open Edge AI and pick what the AI should learn.';
    }
    const parts = kindProblem(ai.kind, connections);
    if (parts) {
        return parts;
    }
    const things = ai.things || [];
    if (things.length < AI_LIMITS.minThings) {
        return `Teach the AI at least ${AI_LIMITS.minThings} things in Edge AI.`;
    }
    if ((ai.samples || []).length && ai.sig !== aiSignature(ai.kind, connections)) {
        return 'Your parts changed since you recorded. Record the examples again in Edge AI.';
    }
    const counts = countsFor(ai);
    const short = things.find(t => counts[t.id] < AI_LIMITS.minExamples);
    if (short) {
        const more = AI_LIMITS.minExamples - counts[short.id];
        return `Record ${more} more example${more === 1 ? '' : 's'} of “${short.name}” in Edge AI.`;
    }
    return null;
};

export {
    AI_KINDS,
    AI_LIMITS,
    AI_VAR,
    MOTION_FEATURES,
    NOTHING,
    UNSURE,
    aiProblem,
    aiSignature,
    countsFor,
    featureCount,
    kindById,
    kindProblem,
    sensorInputs,
    thingKeys,
    thingNameProblem
};
