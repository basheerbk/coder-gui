import {
    WAITLIST_KEY,
    getRedisConfig,
    normalizeEmail,
    readJsonBody,
    redisPipeline,
    sendJson
} from '../lib/waitlist/store.mjs';

const RATE_LIMIT_PER_HOUR = 10;

const clientIp = req => {
    const forwarded = String(req.headers['x-forwarded-for'] || '');
    return forwarded.split(',')[0].trim() || 'unknown';
};

export default async function handler (req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, {ok: false, error: 'method_not_allowed'});
        return;
    }

    const body = await readJsonBody(req);

    // Honeypot: real visitors never see or fill the "company" field.
    if (body.company) {
        sendJson(res, 200, {ok: true});
        return;
    }

    const email = normalizeEmail(body.email);
    if (!email) {
        sendJson(res, 400, {ok: false, error: 'invalid_email'});
        return;
    }

    const config = getRedisConfig();
    if (!config) {
        console.error('[waitlist] Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).');
        sendJson(res, 503, {ok: false, error: 'not_configured'});
        return;
    }

    try {
        const rateKey = `waitlist:rl:${clientIp(req)}`;
        const [attempts] = await redisPipeline(config, [
            ['INCR', rateKey],
            ['EXPIRE', rateKey, 3600]
        ]);
        if (attempts > RATE_LIMIT_PER_HOUR) {
            sendJson(res, 429, {ok: false, error: 'rate_limited'});
            return;
        }

        // NX keeps the first signup time; duplicates are a normal success for the visitor.
        const [added] = await redisPipeline(config, [
            ['ZADD', WAITLIST_KEY, 'NX', Date.now(), email]
        ]);
        sendJson(res, 200, {ok: true, duplicate: added === 0});
    } catch (err) {
        console.error('[waitlist] store failed', err && err.message);
        sendJson(res, 502, {ok: false, error: 'store_failed'});
    }
}
