import {SignJWT, jwtVerify} from 'jose';

export const SESSION_COOKIE = 'tb_session';
export const OAUTH_STATE_COOKIE = 'tb_oauth_state';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days
export const STATE_MAX_AGE_SEC = 60 * 10; // 10 minutes

const textEncoder = new TextEncoder();

export function getAuthBaseUrl (req) {
    if (process.env.AUTH_BASE_URL) {
        return process.env.AUTH_BASE_URL.replace(/\/$/, '');
    }
    if (req && req.headers) {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const proto = req.headers['x-forwarded-proto'] || 'https';
        if (host) {
            return `${proto}://${host}`;
        }
    }
    return 'http://127.0.0.1:8601';
}

export function isAuthDisabled () {
    if (process.env.AUTH_DISABLED !== '1' && process.env.AUTH_DISABLED !== 'true') {
        return false;
    }
    // Never allow disable on Vercel production
    return process.env.VERCEL_ENV !== 'production';
}

export function getSecretKey () {
    const secret = process.env.AUTH_SECRET;
    if (!secret || String(secret).length < 32) {
        return null;
    }
    return textEncoder.encode(String(secret));
}

export function parseCookies (cookieHeader) {
    const out = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return out;
    }
    cookieHeader.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) {
            out[key] = decodeURIComponent(value);
        }
    });
    return out;
}

export function cookieOptions ({maxAge, httpOnly = true} = {}) {
    const secure = process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        (process.env.AUTH_BASE_URL || '').startsWith('https://');
    const parts = [
        'Path=/',
        'SameSite=Lax'
    ];
    if (httpOnly) {
        parts.push('HttpOnly');
    }
    if (secure) {
        parts.push('Secure');
    }
    if (typeof maxAge === 'number') {
        parts.push(`Max-Age=${maxAge}`);
    }
    return parts.join('; ');
}

export function serializeCookie (name, value, options) {
    return `${name}=${encodeURIComponent(value)}; ${cookieOptions(options)}`;
}

export function clearCookie (name) {
    return `${name}=; ${cookieOptions({maxAge: 0, httpOnly: true})}`;
}

/**
 * Allow only same-app relative paths under /choose, /beginner, or /ide (open-redirect safe).
 * @param {string} next
 * @returns {string}
 */
export function sanitizeNextPath (next) {
    if (!next || typeof next !== 'string') {
        return '/choose';
    }
    let value = next.trim();
    try {
        value = decodeURIComponent(value);
    } catch (err) {
        return '/choose';
    }
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
        return '/choose';
    }
    if (value.includes('://')) {
        return '/choose';
    }
    const pathOnly = value.split('?')[0].split('#')[0];
    const allowed =
        pathOnly === '/choose' || pathOnly === '/choose/' ||
        pathOnly === '/beginner' || pathOnly === '/beginner/' ||
        pathOnly === '/beginner.html' || pathOnly === '/choose.html' ||
        pathOnly === '/ide' || pathOnly.startsWith('/ide/') || pathOnly === '/ide.html';
    if (!allowed) {
        return '/choose';
    }
    return value;
}

export async function createSessionToken (user) {
    const key = getSecretKey();
    if (!key) {
        throw new Error('AUTH_SECRET is not configured');
    }
    return new SignJWT({
        email: user.email || '',
        name: user.name || '',
        picture: user.picture || ''
    })
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(String(user.sub))
        .setIssuedAt()
        .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
        .sign(key);
}

export async function verifySessionToken (token) {
    const key = getSecretKey();
    if (!key || !token) {
        return null;
    }
    try {
        const {payload} = await jwtVerify(token, key, {
            algorithms: ['HS256']
        });
        if (!payload || !payload.sub) {
            return null;
        }
        return {
            sub: String(payload.sub),
            email: payload.email ? String(payload.email) : '',
            name: payload.name ? String(payload.name) : '',
            picture: payload.picture ? String(payload.picture) : ''
        };
    } catch (err) {
        return null;
    }
}

export async function readSessionFromRequest (req) {
    if (isAuthDisabled()) {
        return {
            sub: 'dev',
            email: 'dev@localhost',
            name: 'Dev',
            picture: ''
        };
    }
    const cookies = parseCookies(req.headers.cookie || req.headers.get?.('cookie'));
    return verifySessionToken(cookies[SESSION_COOKIE]);
}

export function logAuthEvent (event, detail = {}) {
    const safe = {
        event,
        ts: new Date().toISOString(),
        ...detail
    };
    // Never log tokens or secrets
    delete safe.token;
    delete safe.code;
    delete safe.access_token;
    delete safe.id_token;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(safe));
}
