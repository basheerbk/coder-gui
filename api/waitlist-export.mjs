import {createHash, timingSafeEqual} from 'node:crypto';

import {WAITLIST_KEY, getRedisConfig, redisPipeline, sendJson} from '../lib/waitlist/store.mjs';

const sha256 = value => createHash('sha256').update(String(value))
    .digest();

const providedToken = req => {
    const auth = String(req.headers.authorization || '');
    if (auth.toLowerCase().startsWith('bearer ')) {
        return auth.slice(7).trim();
    }
    return (req.query && req.query.token) ? String(req.query.token) : '';
};

const csvCell = value => {
    let text = String(value);
    // Stop spreadsheet apps from treating a cell as a formula.
    if (/^[=+\-@]/.test(text)) {
        text = `'${text}`;
    }
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default async function handler (req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        sendJson(res, 405, {ok: false, error: 'method_not_allowed'});
        return;
    }

    const expected = process.env.WAITLIST_EXPORT_TOKEN;
    if (!expected || expected.length < 16) {
        sendJson(res, 503, {ok: false, error: 'export_not_configured'});
        return;
    }
    if (!timingSafeEqual(sha256(providedToken(req)), sha256(expected))) {
        sendJson(res, 401, {ok: false, error: 'unauthorized'});
        return;
    }

    const config = getRedisConfig();
    if (!config) {
        sendJson(res, 503, {ok: false, error: 'not_configured'});
        return;
    }

    try {
        const [flat] = await redisPipeline(config, [['ZRANGE', WAITLIST_KEY, 0, -1, 'WITHSCORES']]);
        const rows = ['email,signed_up_at'];
        for (let i = 0; i < (flat || []).length; i += 2) {
            const signedUp = new Date(Number(flat[i + 1])).toISOString();
            rows.push(`${csvCell(flat[i])},${signedUp}`);
        }
        const day = new Date().toISOString()
            .slice(0, 10);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="tinkerbit-waitlist-${day}.csv"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex');
        res.end(`${rows.join('\n')}\n`);
    } catch (err) {
        console.error('[waitlist-export] read failed', err && err.message);
        sendJson(res, 502, {ok: false, error: 'store_failed'});
    }
}
