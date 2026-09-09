import {randomBytes} from 'crypto';
import {
    OAUTH_STATE_COOKIE,
    STATE_MAX_AGE_SEC,
    getAuthBaseUrl,
    isAuthDisabled,
    logAuthEvent,
    sanitizeNextPath,
    serializeCookie
} from '../../lib/auth/session.mjs';

export default async function handler (req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    if (isAuthDisabled()) {
        res.statusCode = 302;
        res.setHeader('Location', sanitizeNextPath(req.query && req.query.next));
        res.end();
        return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !process.env.AUTH_SECRET) {
        logAuthEvent('google_start_misconfigured');
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><title>Auth unavailable</title><p>Sign-in is not configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_SECRET.</p>');
        return;
    }

    const next = sanitizeNextPath(req.query && req.query.next);
    const state = randomBytes(24).toString('hex');
    const statePayload = Buffer.from(JSON.stringify({state, next}), 'utf8').toString('base64url');
    const baseUrl = getAuthBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/callback`;

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'online',
        prompt: 'select_account'
    });

    logAuthEvent('google_start');
    res.statusCode = 302;
    res.setHeader('Set-Cookie', serializeCookie(OAUTH_STATE_COOKIE, statePayload, {
        maxAge: STATE_MAX_AGE_SEC,
        httpOnly: true
    }));
    res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
}
