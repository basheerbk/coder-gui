/**
 * Turns what a freshly uploaded Cloud board prints over USB (see cloudFirmware.js) and what
 * the Cloud service reports into the steps of the "going live" checklist.
 */

const LINE_EVENTS = [
    {re: /^Cloud: joining WiFi/, type: 'wifi_joining'},
    {re: /^Cloud: WiFi connected/, type: 'wifi_ok'},
    {re: /^Cloud: WiFi name not found/, type: 'wifi_not_found'},
    {re: /^Cloud: wrong WiFi password/, type: 'wifi_password'},
    {re: /^Cloud: WiFi (lost|stuck)/, type: 'wifi_lost'},
    {re: /^Cloud: connecting to /, type: 'cloud_connecting'},
    {re: /^Cloud: connected/, type: 'cloud_ok'},
    {re: /^Cloud: (disconnected|reconnect stuck|port 8883 blocked|trying port 8883)/, type: 'cloud_retry'},
    {re: /^Cloud: login rejected/, type: 'cloud_rejected'},
    {re: /^Cloud: not enough memory/, type: 'no_memory'}
];

/** The checklist event for one line the board printed, or null. */
const parseCloudLine = line => {
    const text = String(line || '').trim();
    const hit = LINE_EVENTS.find(e => e.re.test(text));
    return hit ? {type: hit.type} : null;
};

/** Collects USB chunks into whole lines (the board's prints arrive split at random places). */
const createLineSplitter = onLine => {
    let rest = '';
    return chunk => {
        rest += chunk;
        const parts = rest.split(/\r?\n/);
        rest = parts.pop();
        if (rest.length > 400) {
            rest = rest.slice(-400);
        }
        parts.forEach(line => onLine(line));
    };
};

/**
 * Step states: waiting | active | done | failed.
 * `problem` names the reason the board is stuck, so the checklist can offer the fix.
 */
const initialProgress = () => ({wifi: 'waiting', cloud: 'waiting', live: 'waiting', problem: null});

const PROBLEM_STEP = {
    wifi_not_found: 'wifi',
    wifi_password: 'wifi',
    cloud_rejected: 'cloud',
    no_memory: 'cloud'
};

const reduceProgress = (state, event) => {
    const next = Object.assign({}, state);
    switch (event.type) {
    case 'wifi_joining':
    case 'wifi_lost':
        if (next.wifi !== 'failed') {
            next.wifi = 'active';
        }
        break;
    case 'wifi_ok':
        next.wifi = 'done';
        if (next.cloud === 'waiting' || next.cloud === 'failed') {
            next.cloud = 'active';
        }
        if (PROBLEM_STEP[next.problem] === 'wifi') {
            next.problem = null;
        }
        break;
    case 'wifi_not_found':
    case 'wifi_password':
        next.wifi = 'failed';
        next.problem = event.type;
        break;
    case 'cloud_connecting':
    case 'cloud_retry':
        next.wifi = next.wifi === 'failed' ? next.wifi : 'done';
        if (next.cloud !== 'failed') {
            next.cloud = 'active';
        }
        break;
    case 'cloud_ok':
        next.wifi = 'done';
        next.cloud = 'done';
        if (next.live !== 'done') {
            next.live = 'active';
        }
        next.problem = null;
        break;
    case 'cloud_rejected':
    case 'no_memory':
        next.wifi = 'done';
        next.cloud = 'failed';
        next.problem = event.type;
        break;
    case 'server_online':
        next.wifi = 'done';
        next.cloud = 'done';
        next.live = 'done';
        next.problem = null;
        break;
    case 'timeout':
        if (next.live !== 'done' && !next.problem) {
            next.problem = 'timeout';
        }
        break;
    default:
        return state;
    }
    return next;
};

/**
 * True once the Cloud service sees the board come online after the upload started.
 * Compares with the board's state before the upload rather than clocks, so a student PC with
 * the wrong time does not matter.
 * @param {object} device the board from GET /devices/:id
 * @param {object} before the same board fetched when the upload started (or null)
 * @returns {boolean} whether the new program is live
 */
const cameOnline = (device, before) => {
    if (!device || device.status !== 'online') {
        return false;
    }
    if (!before || before.status !== 'online') {
        return true;
    }
    return Boolean(device.onlineSince) && device.onlineSince !== before.onlineSince;
};

/** "Smart Garden" → "Smart Garden 2" when the student already has a board with that name. */
const uniqueBoardName = (base, names, max = 40) => {
    const clean = String(base || '').trim().slice(0, max) || 'My board';
    const taken = new Set((names || []).map(n => String(n).trim().toLowerCase()));
    if (!taken.has(clean.toLowerCase())) {
        return clean;
    }
    for (let n = 2; n < 100; n++) {
        const suffix = ` ${n}`;
        const candidate = `${clean.slice(0, max - suffix.length).trim()}${suffix}`;
        if (!taken.has(candidate.toLowerCase())) {
            return candidate;
        }
    }
    return clean;
};

export {
    cameOnline,
    createLineSplitter,
    initialProgress,
    parseCloudLine,
    reduceProgress,
    uniqueBoardName
};
