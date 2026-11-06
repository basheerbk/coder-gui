/**
 * The Edge AI model: k nearest neighbours on standardised features. The board runs the same
 * steps in aiClassify(), so "Try it" in the browser and the uploaded program agree.
 */
const K = 3;
const MIN_SPREAD = 1e-6;

/**
 * Examples the model can use: their thing still exists and they have the expected length.
 * @param {object} ai {things, samples}
 * @param {number} [length] feature count (defaults to the first usable example's)
 * @returns {Array} usable samples
 */
const usableSamples = (ai, length) => {
    const ids = {};
    ((ai && ai.things) || []).forEach(t => {
        ids[t.id] = true;
    });
    const samples = ((ai && ai.samples) || []).filter(s => ids[s.thing] && Array.isArray(s.f) && s.f.length);
    const n = length || (samples.length ? samples[0].f.length : 0);
    return samples.filter(s => s.f.length === n);
};

const sqDist = (a, b) => {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i] - b[i];
        d += x * x;
    }
    return d;
};

/** Majority of the k nearest; a tie goes to the label seen first (the nearest). */
const vote = labels => {
    const counts = {};
    let best = labels[0];
    labels.forEach(l => {
        counts[l] = (counts[l] || 0) + 1;
    });
    labels.forEach(l => {
        if (counts[l] > counts[best]) {
            best = l;
        }
    });
    return {label: best, votes: counts[best]};
};

/** The k nearest rows (indices into X), nearest first, skipping rows `skip` rejects. */
const nearest = (X, z, k, skip) => {
    const top = [];
    for (let n = 0; n < X.length; n++) {
        if (skip && skip(n)) {
            continue;
        }
        const d = sqDist(X[n], z);
        if (top.length < k || d < top[top.length - 1].d) {
            let at = top.length;
            while (at > 0 && top[at - 1].d > d) {
                at--;
            }
            top.splice(at, 0, {n, d});
            if (top.length > k) {
                top.pop();
            }
        }
    }
    return top;
};

const percentile = (values, p) => {
    if (!values.length) {
        return 0;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

/**
 * @param {object} ai {things, samples}
 * @returns {object|null} {F, mean, scale, X, y, limit, k, things} or null without examples
 *   y holds 1-based thing positions; limit is the distance past which the answer is "Not sure".
 */
const trainModel = ai => {
    const samples = usableSamples(ai);
    if (!samples.length) {
        return null;
    }
    const things = ai.things;
    const F = samples[0].f.length;
    const mean = new Array(F).fill(0);
    const scale = new Array(F).fill(1);
    samples.forEach(s => s.f.forEach((v, i) => {
        mean[i] += v / samples.length;
    }));
    for (let i = 0; i < F; i++) {
        let sq = 0;
        samples.forEach(s => {
            sq += (s.f[i] - mean[i]) * (s.f[i] - mean[i]);
        });
        const sd = Math.sqrt(sq / samples.length);
        scale[i] = sd > MIN_SPREAD ? 1 / sd : 1;
    }
    const X = samples.map(s => s.f.map((v, i) => (v - mean[i]) * scale[i]));
    const y = samples.map(s => things.findIndex(t => t.id === s.thing) + 1);
    // How far an example usually is from its closest look-alike of the same thing.
    const gaps = [];
    X.forEach((row, n) => {
        const [close] = nearest(X, row, 1, m => m === n || y[m] !== y[n]);
        if (close) {
            gaps.push(Math.sqrt(close.d));
        }
    });
    const limit = Math.max(3 * percentile(gaps, 0.75), 0.15 * Math.sqrt(F));
    return {F, mean, scale, X, y, limit, k: Math.min(K, X.length), things};
};

/**
 * @param {object} model from trainModel
 * @param {Array<number>} f features from the board
 * @returns {{thing: (object|null), unsure: boolean, distance: number, votes: number}} thing is null when unsure
 */
const classify = (model, f) => {
    if (!model || !Array.isArray(f) || f.length !== model.F) {
        return {thing: null, unsure: true, distance: Infinity, votes: 0};
    }
    const z = f.map((v, i) => (v - model.mean[i]) * model.scale[i]);
    const top = nearest(model.X, z, model.k);
    const distance = Math.sqrt(top[0].d);
    if (distance > model.limit) {
        return {thing: null, unsure: true, distance, votes: 0};
    }
    const {label, votes} = vote(top.map(t => model.y[t.n]));
    return {thing: model.things[label - 1] || null, unsure: false, distance, votes};
};

/**
 * Held-out check: each example is answered by the others, leaving out its whole recording
 * (take) when its thing has more than one, so near-copies recorded back to back do not count.
 * @param {object} ai {things, samples}
 * @returns {object|null} {right, total, perThing: {id: {right, total, mixedWith: {id: n}}}}
 */
const checkModel = ai => {
    const model = trainModel(ai);
    if (!model || model.things.length < 2) {
        return null;
    }
    const samples = usableSamples(ai, model.F);
    const takesOf = {};
    samples.forEach(s => {
        takesOf[s.thing] = takesOf[s.thing] || {};
        takesOf[s.thing][s.take] = true;
    });
    const perThing = {};
    model.things.forEach(t => {
        perThing[t.id] = {right: 0, total: 0, mixedWith: {}};
    });
    let right = 0;
    let total = 0;
    samples.forEach((s, n) => {
        const leaveTake = Object.keys(takesOf[s.thing]).length > 1;
        const skip = m => m === n || (leaveTake && samples[m].thing === s.thing && samples[m].take === s.take);
        const top = nearest(model.X, model.X[n], model.k, skip);
        if (!top.length) {
            return;
        }
        const guess = model.things[vote(top.map(t => model.y[t.n])).label - 1];
        const row = perThing[s.thing];
        row.total++;
        total++;
        if (guess && guess.id === s.thing) {
            row.right++;
            right++;
        } else if (guess) {
            row.mixedWith[guess.id] = (row.mixedWith[guess.id] || 0) + 1;
        }
    });
    return {right, total, perThing};
};

export {checkModel, classify, trainModel, usableSamples};
