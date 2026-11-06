import {AI_LIMITS, kindById, thingNameProblem} from './aiKinds';

const MAX_FEATURES = 64;

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A fresh AI that has not learned anything yet. */
const emptyAi = kind => ({kind: kindById(kind) ? kind : null, things: [], samples: [], sig: null});

/**
 * A saved or loaded AI with anything broken dropped (unknown things, odd lengths, too many
 * examples), or null when there is nothing usable.
 */
const cleanAi = raw => {
    if (!isObject(raw)) {
        return null;
    }
    const things = [];
    (Array.isArray(raw.things) ? raw.things : []).forEach(t => {
        if (things.length >= AI_LIMITS.maxThings || !isObject(t) || typeof t.id !== 'string' || !t.id ||
            typeof t.name !== 'string' || things.some(o => o.id === t.id) || thingNameProblem(t.name, things)) {
            return;
        }
        things.push({id: t.id.slice(0, 40), name: t.name.trim()});
    });
    const ids = {};
    things.forEach(t => {
        ids[t.id] = 0;
    });
    let length = 0;
    const samples = [];
    (Array.isArray(raw.samples) ? raw.samples : []).forEach(s => {
        if (!isObject(s) || !Object.prototype.hasOwnProperty.call(ids, s.thing) || !Array.isArray(s.f) ||
            !s.f.length || s.f.length > MAX_FEATURES || s.f.some(v => typeof v !== 'number' || !Number.isFinite(v)) ||
            ids[s.thing] >= AI_LIMITS.maxExamples) {
            return;
        }
        length = length || s.f.length;
        if (s.f.length !== length) {
            return;
        }
        ids[s.thing]++;
        samples.push({thing: s.thing, take: Number.isInteger(s.take) && s.take >= 0 ? s.take : 0, f: s.f.slice()});
    });
    return {
        kind: kindById(raw.kind) ? raw.kind : null,
        things,
        samples,
        sig: samples.length && typeof raw.sig === 'string' ? raw.sig.slice(0, 300) : null
    };
};

/** Keeps saved projects small: 4 decimals is finer than the sensors can tell apart. */
const roundFeatures = f => f.map(v => Math.round(v * 10000) / 10000);

const withThings = (ai, things) => Object.assign({}, ai, {things});

/** Switching kind keeps the names but drops the examples (they were made with other parts). */
const setKind = (ai, kind) => {
    if (!kindById(kind)) {
        return ai;
    }
    if (ai && ai.kind === kind) {
        return ai;
    }
    return Object.assign(emptyAi(kind), {things: ai ? ai.things : []});
};

const addThing = (ai, id, name) => {
    const base = ai || emptyAi(null);
    if (base.things.length >= AI_LIMITS.maxThings || thingNameProblem(name, base.things)) {
        return base;
    }
    return withThings(base, base.things.concat([{id, name: String(name).trim()}]));
};

const renameThing = (ai, id, name) => {
    if (!ai || thingNameProblem(name, ai.things, id)) {
        return ai;
    }
    return withThings(ai, ai.things.map(t => (t.id === id ? Object.assign({}, t, {name: String(name).trim()}) : t)));
};

const removeThing = (ai, id) => {
    if (!ai) {
        return ai;
    }
    const samples = ai.samples.filter(s => s.thing !== id);
    return Object.assign({}, ai, {
        things: ai.things.filter(t => t.id !== id),
        samples,
        sig: samples.length ? ai.sig : null
    });
};

const clearThing = (ai, id) => {
    if (!ai) {
        return ai;
    }
    const samples = ai.samples.filter(s => s.thing !== id);
    return Object.assign({}, ai, {samples, sig: samples.length ? ai.sig : null});
};

/**
 * Adds one recording of a thing as a single step. Examples made with other parts (another
 * signature or length) replace the old ones, which could not be mixed with them.
 */
const addTake = (ai, thingId, examples, sig) => {
    if (!ai || !ai.things.some(t => t.id === thingId) || !examples.length) {
        return ai;
    }
    const length = examples[0].length;
    const fresh = ai.sig !== sig || ai.samples.some(s => s.f.length !== length);
    const kept = fresh ? [] : ai.samples;
    const have = kept.filter(s => s.thing === thingId).length;
    const room = Math.max(0, AI_LIMITS.maxExamples - have);
    const take = kept.reduce((max, s) => Math.max(max, s.take), -1) + 1;
    const added = examples
        .filter(f => f.length === length)
        .slice(0, room)
        .map(f => ({thing: thingId, take, f: roundFeatures(f)}));
    if (!added.length) {
        return ai;
    }
    return Object.assign({}, ai, {samples: kept.concat(added), sig});
};

export {addTake, addThing, cleanAi, clearThing, emptyAi, removeThing, renameThing, setKind};
