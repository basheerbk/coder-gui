import {EventEmitter} from 'node:events';

import {SignJWT} from 'jose';

import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {openDatabase} from '../src/db.js';

process.env.IOT_LOG_SILENT = '1';

export const SECRET = 'test-secret-test-secret-test-secret-123';
export const ORIGIN = 'https://www.tinkerbit.io';

export class FakeBroker extends EventEmitter {
    constructor () {
        super();
        this.connected = true;
        this.fail = false;
        this.published = [];
        this.calls = [];
        const rec = name => (...args) => {
            this.calls.push([name, ...args]);
            return this.fail ? Promise.reject(new Error('broker down')) : Promise.resolve();
        };
        this.admin = {
            createDevice: rec('createDevice'),
            setPassword: rec('setPassword'),
            disable: rec('disable'),
            enable: rec('enable'),
            kick: rec('kick'),
            remove: rec('remove')
        };
    }

    start () {}

    isConnected () {
        return this.connected;
    }

    publish (topic, payload, opts = {}) {
        if (!this.connected || this.fail) {
            return Promise.reject(new Error('not connected'));
        }
        this.published.push(Object.assign({topic, payload: String(payload)}, opts));
        return Promise.resolve();
    }

    stop () {
        return Promise.resolve();
    }

    callsOf (name) {
        return this.calls.filter(c => c[0] === name);
    }
}

export function testConfig (overrides = {}) {
    const base = loadConfig(Object.assign({
        NODE_ENV: 'test',
        AUTH_SECRET: SECRET,
        IOT_BROKER_MODE: 'mosquitto',
        MQTT_INGEST_USER: 'ingest',
        MQTT_INGEST_PASS: 'ingest-pass',
        MQTT_ADMIN_USER: 'admin',
        MQTT_ADMIN_PASS: 'admin-pass',
        IOT_ALLOWED_ORIGINS: ORIGIN,
        IOT_ALLOWLIST: 'alice@example.com,bob@example.com',
        IOT_PORT: '0',
        IOT_DB_PATH: ':memory:'
    }, overrides));
    return Object.assign({}, base, {limits: Object.assign({}, base.limits)});
}

/** A controllable clock so offline grace, cooldowns and throttles are testable. */
export function clock (start = Date.UTC(2026, 10, 1, 8, 0, 0)) {
    let t = start;
    const now = () => t;
    now.advance = ms => {
        t += ms;
        return t;
    };
    now.set = v => {
        t = v;
    };
    return now;
}

export async function startTestApp ({config, now} = {}) {
    const cfg = config || testConfig();
    const broker = new FakeBroker();
    const app = createApp({config: cfg, db: openDatabase(':memory:'), broker, now});
    const address = await app.start();
    const base = `http://127.0.0.1:${address.port}`;
    return Object.assign(app, {broker, base, config: cfg, port: address.port});
}

export async function sessionCookie (sub, email) {
    const jwt = await new SignJWT({email, name: sub})
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(SECRET));
    return `tb_session=${jwt}`;
}

export function client (base, cookie) {
    const call = async (method, path, body, extraHeaders = {}) => {
        const headers = Object.assign({}, extraHeaders);
        if (cookie) {
            headers.cookie = cookie;
        }
        if (method !== 'GET') {
            headers.origin = headers.origin === undefined ? ORIGIN : headers.origin;
        }
        if (body !== undefined) {
            headers['content-type'] = headers['content-type'] || 'application/json';
        }
        const res = await fetch(`${base}/iot/v1${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
        });
        let json = null;
        try {
            json = await res.json();
        } catch (err) {
            json = null;
        }
        return {status: res.status, body: json, headers: res.headers};
    };
    return {
        get: (p, h) => call('GET', p, undefined, h),
        post: (p, b, h) => call('POST', p, b === undefined ? {} : b, h),
        put: (p, b, h) => call('PUT', p, b, h),
        patch: (p, b, h) => call('PATCH', p, b, h),
        del: (p, b, h) => call('DELETE', p, b, h),
        raw: call
    };
}

export const telemetry = (v, seq, boot = 'abc1') => Buffer.from(JSON.stringify({seq, boot, v}));
