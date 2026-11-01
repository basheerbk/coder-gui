/**
 * Browser client for TinkerBit Cloud. Requests go to /api/iot/* on the site origin; Vercel
 * (or the dev server proxy) forwards them to https://api.tinkerbit.io/iot/v1/* with the
 * tb_session cookie, so no tokens are ever handled here.
 */
const BASE = '/api/iot';

class IotApiError extends Error {
    constructor (status, code, body, retryAfterSec) {
        super(code);
        this.status = status;
        this.code = code;
        this.body = body || {};
        this.retryAfterSec = retryAfterSec || 0;
    }
}

const ERROR_TEXT = {
    unauthenticated: 'Please sign in again.',
    not_in_pilot: 'TinkerBit Cloud is in a private pilot. Ask your teacher to add your account.',
    forbidden: 'Your account cannot do that.',
    device_limit: 'You have reached the device limit. Delete an old device first.',
    create_limit: 'Too many new devices today. Try again tomorrow.',
    rate_limited: 'Slow down a little and try again.',
    version_conflict: 'Someone else changed this at the same time. Showing the latest.',
    disabled: 'TinkerBit Cloud is paused for maintenance. Try again later.',
    restarting: 'TinkerBit Cloud is restarting. Try again in a few seconds.',
    broker_unavailable: 'The cloud could not reach the board service. Try again in a minute.',
    not_found: 'That device no longer exists.',
    rule_limit: 'This device already has the maximum number of alert rules.',
    too_large: 'That is too much data to send at once.',
    body_too_large: 'That is too much data to send at once.',
    unknown_control: 'The board does not have that control any more. Upload the program again.',
    too_many_tickets: 'Too many dashboards are open. Close a few tabs and try again.',
    bad_origin: 'Open TinkerBit from www.tinkerbit.io and try again.',
    internal: 'Something went wrong on our side. Try again; if it keeps happening, tell your teacher.',
    offline: 'You are offline. Reconnect to the internet and try again.',
    network: 'Could not connect to TinkerBit Cloud. Check your internet connection and try again.',
    timeout: 'TinkerBit Cloud is taking too long to answer. Try again in a minute.',
    unavailable: 'TinkerBit Cloud is not available right now. Your projects are safe; try again later.'
};

/** Failures where trying again later can succeed without the user changing anything. */
const TRANSIENT = ['offline', 'network', 'timeout', 'unavailable', 'restarting', 'broker_unavailable', 'rate_limited'];
const isTransient = err => Boolean(err && TRANSIENT.indexOf(err.code) !== -1);

/** Student-friendly text for an IotApiError, or for a bare error code string. */
const errorText = err => {
    if (!err) {
        return '';
    }
    if (typeof err === 'string') {
        return ERROR_TEXT[err] || `Something went wrong (${err}).`;
    }
    if (err instanceof IotApiError) {
        if (err.code === 'rate_limited' && err.retryAfterSec > 0) {
            return `Slow down a little and try again in ${Math.ceil(err.retryAfterSec)} s.`;
        }
        return ERROR_TEXT[err.code] || `Something went wrong (${err.code}).`;
    }
    return ERROR_TEXT.network;
};

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Error code for a response without a JSON error body. The IoT service always answers in
 * JSON, so anything else came from the Vercel edge (upstream down, DNS missing, rewrite not
 * deployed) and means the service is unavailable rather than that the request was wrong.
 */
const gatewayCode = status => {
    if (status === 401) {
        return 'unauthenticated';
    }
    if (status === 403) {
        return 'forbidden';
    }
    if (status === 408 || status === 504) {
        return 'timeout';
    }
    if (status === 413) {
        return 'too_large';
    }
    if (status === 429) {
        return 'rate_limited';
    }
    if (status === 404 || status >= 500) {
        return 'unavailable';
    }
    return `http_${status}`;
};

const readJson = async res => {
    const type = (res.headers.get('Content-Type') || '').toLowerCase();
    if (type.indexOf('json') === -1) {
        return null;
    }
    try {
        return await res.json();
    } catch (err) {
        return null;
    }
};

const attempt = async (method, path, body, timeoutMs) => {
    if (isOffline()) {
        throw new IotApiError(0, 'offline', null, 0);
    }
    const headers = {Accept: 'application/json'};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    let timedOut = false;
    const timer = controller ? setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs) : null;
    let res;
    let json;
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            credentials: 'same-origin',
            cache: 'no-store',
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller ? controller.signal : undefined
        });
        // Read the body under the same deadline: a stalled body would otherwise hang forever.
        json = res.status === 204 ? null : await readJson(res);
    } catch (err) {
        let code = 'network';
        if (timedOut) {
            code = 'timeout';
        } else if (isOffline()) {
            code = 'offline';
        }
        throw new IotApiError(0, code, null, 0);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
    const retryAfterSec = Number(res.headers.get('Retry-After')) || 0;
    if (!res.ok) {
        const code = (json && typeof json.error === 'string' && json.error) || gatewayCode(res.status);
        throw new IotApiError(res.status, code, json, retryAfterSec);
    }
    if (res.status !== 204 && (!json || typeof json !== 'object')) {
        // A 200 that is not JSON is a misrouted request (for example the site's HTML page).
        throw new IotApiError(res.status, 'unavailable', null, 0);
    }
    return json;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const request = async (method, path, body, {timeoutMs = 15000} = {}) => {
    try {
        return await attempt(method, path, body, timeoutMs);
    } catch (err) {
        // Reads are safe to repeat; retry once after a blip. Writes are never repeated
        // because the first one may have reached the server.
        const blip = err.code === 'network' || (err.code === 'unavailable' && err.status >= 502);
        if (method !== 'GET' || !blip) {
            throw err;
        }
        await sleep(800);
        return attempt(method, path, body, timeoutMs);
    }
};

const enc = encodeURIComponent;
const query = params => Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${k}=${enc(params[k])}`)
    .join('&');

const iotApi = {
    // Short deadline: this is the first call on every page, and a dead upstream makes the
    // edge hang for 30 s or more before failing.
    config: () => request('GET', '/config', undefined, {timeoutMs: 8000}),
    listDevices: () => request('GET', '/devices'),
    createDevice: name => request('POST', '/devices', {name}),
    getDevice: id => request('GET', `/devices/${enc(id)}`),
    updateDevice: (id, patch) => request('PATCH', `/devices/${enc(id)}`, patch),
    deleteDevice: id => request('DELETE', `/devices/${enc(id)}`),
    regenerateToken: id => request('POST', `/devices/${enc(id)}/token`, {}),
    enableDevice: id => request('POST', `/devices/${enc(id)}/enable`, {}),
    setControl: (id, key, body) => request('PUT', `/devices/${enc(id)}/controls/${enc(key)}`, body),
    history: (id, key, {from, to, points} = {}) =>
        request('GET', `/devices/${enc(id)}/history?${query({key, from, to, points})}`),
    saveDashboard: (id, layout, expectedVersion) =>
        request('PUT', `/devices/${enc(id)}/dashboard`, {layout, expectedVersion}),
    suggestDashboard: (id, keys, controls) =>
        request('POST', `/devices/${enc(id)}/dashboard/suggest`, {keys, controls}),
    createRule: (id, rule) => request('POST', `/devices/${enc(id)}/rules`, rule),
    updateRule: (id, ruleId, patch) => request('PATCH', `/devices/${enc(id)}/rules/${enc(ruleId)}`, patch),
    deleteRule: (id, ruleId) => request('DELETE', `/devices/${enc(id)}/rules/${enc(ruleId)}`),
    alerts: ({device, before, limit} = {}) => request('GET', `/alerts?${query({device, before, limit})}`),
    markAlertsRead: (upToId, deviceId) => request('POST', '/alerts/read', {upToId, deviceId}),
    liveTicket: () => request('POST', '/live/ticket', {}),
    exportMe: () => request('GET', '/me/export', undefined, {timeoutMs: 60000}),
    deleteMe: () => request('DELETE', '/me/data', {confirm: 'DELETE'})
};

export {IotApiError, errorText, iotApi, isTransient};
