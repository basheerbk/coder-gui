import {
    OAUTH_STATE_COOKIE,
    SESSION_COOKIE,
    SESSION_MAX_AGE_SEC,
    clearCookie,
    createSessionToken,
    getAuthBaseUrl,
    isAuthDisabled,
    logAuthEvent,
    parseCookies,
    sanitizeNextPath,
    serializeCookie
} from '../../lib/auth/session.mjs';

function redirectLogin (res, errorCode) {
    const q = errorCode ? `?error=${encodeURIComponent(errorCode)}` : '';
    res.statusCode = 302;
    res.setHeader('Location', `/login${q}`);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
}

export default async function handler (req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    if (isAuthDisabled()) {
        res.statusCode = 302;
        res.setHeader('Location', '/ide');
        res.end();
        return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !process.env.AUTH_SECRET) {
        logAuthEvent('callback_misconfigured');
        redirectLogin(res, 'config');
        return;
    }

    const query = req.query || {};
    if (query.error) {
        logAuthEvent('callback_google_error', {error: String(query.error)});
        redirectLogin(res, 'denied');
        return;
    }

    const code = query.code;
    const state = query.state;
    if (!code || !state) {
        logAuthEvent('callback_missing_params');
        redirectLogin(res, 'invalid');
        return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const rawState = cookies[OAUTH_STATE_COOKIE];
    let stored = null;
    try {
        stored = rawState ? JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) : null;
    } catch (err) {
        stored = null;
    }

    if (!stored || !stored.state || stored.state !== state) {
        logAuthEvent('callback_state_mismatch');
        res.setHeader('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE));
        redirectLogin(res, 'invalid');
        return;
    }

    const next = sanitizeNextPath(stored.next);
    const baseUrl = getAuthBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/callback`;

    let tokenJson;
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({
                code: String(code),
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        tokenJson = await tokenRes.json();
        if (!tokenRes.ok || !tokenJson.access_token) {
            logAuthEvent('callback_token_exchange_failed');
            redirectLogin(res, 'invalid');
            return;
        }
    } catch (err) {
        logAuthEvent('callback_token_exchange_error');
        redirectLogin(res, 'invalid');
        return;
    }

    let profile;
    try {
        const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {Authorization: `Bearer ${tokenJson.access_token}`}
        });
        profile = await profileRes.json();
        if (!profileRes.ok || !profile.sub) {
            logAuthEvent('callback_profile_failed');
            redirectLogin(res, 'invalid');
            return;
        }
    } catch (err) {
        logAuthEvent('callback_profile_error');
        redirectLogin(res, 'invalid');
        return;
    }

    let sessionToken;
    try {
        sessionToken = await createSessionToken({
            sub: profile.sub,
            email: profile.email || '',
            name: profile.name || profile.email || 'User',
            picture: profile.picture || ''
        });
    } catch (err) {
        logAuthEvent('callback_session_failed');
        redirectLogin(res, 'config');
        return;
    }

    logAuthEvent('callback_success', {sub: profile.sub});
    res.statusCode = 302;
    res.setHeader('Set-Cookie', [
        serializeCookie(SESSION_COOKIE, sessionToken, {
            maxAge: SESSION_MAX_AGE_SEC,
            httpOnly: true
        }),
        clearCookie(OAUTH_STATE_COOKIE)
    ]);
    res.setHeader('Location', next);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
}
