import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import {compileRoutes, routes} from './api.js';
import {isAllowedOrigin, isAllowedUser, readSession} from './auth.js';
import {HttpError} from './cloud.js';
import {isWritable} from './db.js';
import {log} from './log.js';
import {RateLimiter} from './ratelimit.js';

const PREFIX = '/iot/v1';
const MAX_BODY_BYTES = 64 * 1024;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const COMPILED = compileRoutes(routes);

const send = (res, status, body, headers) => {
    const text = JSON.stringify(body);
    res.writeHead(status, Object.assign({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': Buffer.byteLength(text)
    }, headers || {}));
    res.end(text);
};

const readBody = req => new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
        req.resume();
        reject(new HttpError(413, 'body_too_large'));
        return;
    }
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            tooLarge = true;
            chunks.length = 0;
            return;
        }
        if (!tooLarge) {
            chunks.push(chunk);
        }
    });
    req.on('end', () => (tooLarge ? reject(new HttpError(413, 'body_too_large')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
});

const parseJson = buf => {
    if (!buf.length) {
        return {};
    }
    try {
        const v = JSON.parse(buf.toString('utf8'));
        if (!v || typeof v !== 'object' || Array.isArray(v)) {
            throw new Error('not an object');
        }
        return v;
    } catch (err) {
        throw new HttpError(400, 'invalid_json');
    }
};

export function diskFreeRatio (file) {
    try {
        const dir = file === ':memory:' ? '.' : path.dirname(path.resolve(file));
        const s = fs.statfsSync(dir);
        return s.bavail / s.blocks;
    } catch (err) {
        return 1;
    }
}

/**
 * @param {{config, repo, cloud, live, broker, now}} deps
 */
export function createHttpServer (deps) {
    const {config, repo, cloud, live, broker} = deps;
    const now = deps.now || Date.now;
    const userLimiter = new RateLimiter(config.limits.userRequestsPerMinute, config.limits.userRequestsPerMinute / 60);
    const controlLimiter = new RateLimiter(20, 10);
    let draining = false;

    const readiness = () => {
        const checks = {
            db: isWritable(repo.db),
            disk: diskFreeRatio(config.dbPath) > 0.15,
            broker: config.brokerMode === 'none' ? true : broker.isConnected(),
            accepting: !draining
        };
        return {ok: Object.values(checks).every(Boolean), checks};
    };

    const handle = async (req, res) => {
        const started = Date.now();
        const requestId = crypto.randomBytes(6).toString('hex');
        res.setHeader('X-Request-Id', requestId);
        let url;
        try {
            url = new URL(req.url, 'http://local');
        } catch (err) {
            send(res, 400, {ok: false, error: 'bad_url'});
            return;
        }
        const pathname = url.pathname;

        if (pathname === '/healthz' || pathname === `${PREFIX}/healthz`) {
            send(res, 200, {ok: true});
            return;
        }
        if (pathname === '/readyz') {
            const r = readiness();
            send(res, r.ok ? 200 : 503, r);
            return;
        }
        if (!pathname.startsWith(`${PREFIX}/`)) {
            send(res, 404, {ok: false, error: 'not_found'});
            return;
        }
        if (draining) {
            send(res, 503, {ok: false, error: 'restarting'}, {'Retry-After': '5'});
            return;
        }
        if (!config.enabled) {
            send(res, 503, {ok: false, error: 'disabled'});
            return;
        }

        const sub = pathname.slice(PREFIX.length);
        let route = null;
        let params = {};
        let pathMatched = false;
        for (const r of COMPILED) {
            const m = r.regex.exec(sub);
            if (!m) {
                continue;
            }
            pathMatched = true;
            if (r.method === req.method) {
                route = r;
                params = {};
                r.names.forEach((name, i) => {
                    try {
                        params[name] = decodeURIComponent(m[i + 1]);
                    } catch (err) {
                        params[name] = '';
                    }
                });
                break;
            }
        }
        if (!route) {
            send(res, pathMatched ? 405 : 404, {ok: false, error: pathMatched ? 'method_not_allowed' : 'not_found'});
            return;
        }

        try {
            if (MUTATING.has(req.method)) {
                if (!isAllowedOrigin(req.headers.origin, config)) {
                    throw new HttpError(403, 'bad_origin');
                }
                const type = String(req.headers['content-type'] || '');
                const length = Number(req.headers['content-length'] || 0);
                if ((length > 0 || req.headers['transfer-encoding']) && !type.startsWith('application/json')) {
                    throw new HttpError(415, 'json_required');
                }
            }
            const user = await readSession(req, config);
            if (!user) {
                throw new HttpError(401, 'unauthenticated');
            }
            const allowed = isAllowedUser(user, config);
            if (route.pilot !== false && !allowed) {
                throw new HttpError(403, 'not_in_pilot');
            }
            const limited = userLimiter.take(user.sub);
            if (!limited.allowed) {
                throw new HttpError(429, 'rate_limited', {retryAfterSec: limited.retryAfterSec});
            }
            if (route.rate === 'control') {
                const c = controlLimiter.take(`${user.sub}:${params.id}`);
                if (!c.allowed) {
                    throw new HttpError(429, 'rate_limited', {retryAfterSec: c.retryAfterSec});
                }
            }
            repo.touchUser(user.sub, user.email, now());
            const body = MUTATING.has(req.method) ? parseJson(await readBody(req)) : {};
            const result = await route.handler({
                user, allowed, params, query: url.searchParams, body, repo, cloud, live, config, now
            });
            if (result && result.status && result.body) {
                send(res, result.status, Object.assign({ok: true}, result.body));
            } else {
                send(res, 200, Object.assign({ok: true}, result || {}));
            }
        } catch (err) {
            if (err instanceof HttpError) {
                const headers = err.extra.retryAfterSec ? {'Retry-After': String(err.extra.retryAfterSec)} : undefined;
                send(res, err.status, Object.assign({ok: false, error: err.code}, err.extra), headers);
            } else {
                log.error('http.unhandled', {requestId, method: req.method, path: pathname, err});
                send(res, 500, {ok: false, error: 'internal', requestId});
            }
        } finally {
            const ms = Date.now() - started;
            if (ms > 1000 || res.statusCode >= 500) {
                log.warn('http.slow_or_failed', {requestId, method: req.method, path: pathname, status: res.statusCode, ms});
            }
        }
    };

    const server = http.createServer((req, res) => {
        handle(req, res).catch(err => {
            log.error('http.fatal', {err});
            if (!res.headersSent) {
                send(res, 500, {ok: false, error: 'internal'});
            }
        });
    });
    server.headersTimeout = 15000;
    server.requestTimeout = 20000;
    server.keepAliveTimeout = 65000;
    server.on('upgrade', (req, socket, head) => live.handleUpgrade(req, socket, head));
    server.on('clientError', (err, socket) => {
        if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
    });

    const sweep = setInterval(() => {
        userLimiter.sweep();
        controlLimiter.sweep();
    }, 5 * 60 * 1000);
    sweep.unref();

    server.startDraining = () => {
        draining = true;
        clearInterval(sweep);
    };
    return server;
}
