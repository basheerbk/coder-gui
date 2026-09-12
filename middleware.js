import {
    SESSION_COOKIE,
    isAuthDisabled,
    parseCookies,
    sanitizeNextPath,
    verifySessionToken
} from './lib/auth/session.mjs';

export const config = {
    matcher: [
        '/ide',
        '/ide/',
        '/ide.html',
        '/choose',
        '/choose/',
        '/choose.html',
        '/beginner',
        '/beginner/',
        '/beginner.html'
    ]
};

export default async function middleware (request) {
    if (isAuthDisabled()) {
        return;
    }

    // If auth is not configured yet, send users to login (fail closed)
    if (!process.env.AUTH_SECRET || !process.env.GOOGLE_CLIENT_ID) {
        const url = new URL('/login', request.url);
        url.searchParams.set('error', 'config');
        return Response.redirect(url, 302);
    }

    const cookies = parseCookies(request.headers.get('cookie') || '');
    const user = await verifySessionToken(cookies[SESSION_COOKIE]);
    if (user) {
        return;
    }

    const requestUrl = new URL(request.url);
    const nextPath = sanitizeNextPath(`${requestUrl.pathname}${requestUrl.search}`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', nextPath);
    return Response.redirect(loginUrl, 302);
}
