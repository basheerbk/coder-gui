import {
    SESSION_COOKIE,
    clearCookie,
    isAuthDisabled,
    logAuthEvent
} from '../../lib/auth/session.mjs';

export default async function handler (req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    logAuthEvent('logout');
    res.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE));
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
        res.statusCode = 302;
        res.setHeader('Location', '/login');
        res.end();
        return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ok: true, disabled: isAuthDisabled()}));
}
