import {jwtVerify} from 'jose';

export const SESSION_COOKIE = 'tb_session';

export function parseCookies (header) {
    const out = {};
    if (!header || typeof header !== 'string') {
        return out;
    }
    header.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx === -1) {
            return;
        }
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) {
            return;
        }
        try {
            out[key] = decodeURIComponent(value);
        } catch (err) {
            out[key] = value;
        }
    });
    return out;
}

/**
 * Verify the site session cookie. It is minted by api/auth/callback.mjs on Vercel with the
 * same AUTH_SECRET, and reaches us through the /api/iot/* rewrite.
 * @returns {Promise<{sub: string, email: string, name: string}|null>}
 */
export async function readSession (req, config) {
    if (config.authDisabled) {
        return {sub: 'dev', email: 'dev@localhost', name: 'Dev'};
    }
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) {
        return null;
    }
    try {
        const key = new TextEncoder().encode(config.authSecret);
        const {payload} = await jwtVerify(token, key, {algorithms: ['HS256']});
        if (!payload || !payload.sub) {
            return null;
        }
        return {
            sub: String(payload.sub).slice(0, 128),
            email: payload.email ? String(payload.email).toLowerCase()
                .slice(0, 254) : '',
            name: payload.name ? String(payload.name).slice(0, 80) : ''
        };
    } catch (err) {
        return null;
    }
}

export function isAllowedUser (user, config) {
    if (config.authDisabled || config.allowAll) {
        return true;
    }
    return Boolean(user.email) && config.allowlist.has(user.email);
}

export function isAllowedOrigin (origin, config) {
    return typeof origin === 'string' && config.allowedOrigins.includes(origin);
}
