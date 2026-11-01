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
    device_limit: 'You have reached the device limit. Delete an old device first.',
    create_limit: 'Too many new devices today. Try again tomorrow.',
    rate_limited: 'Slow down a little and try again.',
    version_conflict: 'Someone else changed this at the same time. Showing the latest.',
    disabled: 'TinkerBit Cloud is paused for maintenance. Try again later.',
    restarting: 'TinkerBit Cloud is restarting. Try again in a few seconds.',
    broker_unavailable: 'The cloud could not reach the board service. Try again in a minute.',
    not_found: 'That device no longer exists.',
    network: 'Cannot reach TinkerBit Cloud. Check your internet connection.',
    rule_limit: 'This device already has the maximum number of alert rules.'
};

/** Student-friendly text for an IotApiError, or for a bare error code string. */
const errorText = err => {
    if (!err) {
        return '';
    }
    if (typeof err === 'string') {
        return ERROR_TEXT[err] || `Something went wrong (${err}).`;
    }
    if (err instanceof IotApiError) {
        return ERROR_TEXT[err.code] || `Something went wrong (${err.code}).`;
    }
    return ERROR_TEXT.network;
};

const request = async (method, path, body, {timeoutMs = 15000} = {}) => {
    const headers = {Accept: 'application/json'};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res;
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            credentials: 'same-origin',
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller ? controller.signal : undefined
        });
    } catch (err) {
        throw new IotApiError(0, 'network', null, 0);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
    let json = null;
    try {
        json = await res.json();
    } catch (err) {
        json = null;
    }
    if (!res.ok) {
        const code = (json && json.error) || (res.status >= 500 ? 'restarting' : `http_${res.status}`);
        throw new IotApiError(res.status, code, json, Number(res.headers.get('Retry-After')) || 0);
    }
    return json;
};

const enc = encodeURIComponent;
const query = params => Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${k}=${enc(params[k])}`)
    .join('&');

const iotApi = {
    config: () => request('GET', '/config'),
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

export {IotApiError, errorText, iotApi};
