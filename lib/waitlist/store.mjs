/**
 * Waitlist storage on Upstash Redis (REST API, no SDK).
 * Emails live in one sorted set: member = lowercased email, score = first signup time (ms).
 */
export const WAITLIST_KEY = 'waitlist:emails';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail (value) {
    const email = String(value || '').trim()
        .toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return null;
    }
    return email;
}

/** Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*. */
export function getRedisConfig () {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        return null;
    }
    return {url: url.replace(/\/$/, ''), token};
}

export async function redisPipeline (config, commands) {
    const res = await fetch(`${config.url}/pipeline`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(commands)
    });
    if (!res.ok) {
        throw new Error(`redis_http_${res.status}`);
    }
    const results = await res.json();
    return results.map(item => {
        if (item && item.error) {
            throw new Error(`redis_error_${item.error}`);
        }
        return item ? item.result : null;
    });
}

export async function readJsonBody (req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (err) {
            return {};
        }
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 10 * 1024) {
            return {};
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (err) {
        return {};
    }
}

export function sendJson (res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}
