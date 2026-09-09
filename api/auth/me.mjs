import {
    isAuthDisabled,
    readSessionFromRequest
} from '../../lib/auth/session.mjs';

export default async function handler (req, res) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    if (isAuthDisabled()) {
        res.statusCode = 200;
        res.end(JSON.stringify({
            authenticated: true,
            disabled: true,
            user: {sub: 'dev', email: 'dev@localhost', name: 'Dev', picture: ''}
        }));
        return;
    }

    const user = await readSessionFromRequest(req);
    if (!user) {
        res.statusCode = 401;
        res.end(JSON.stringify({authenticated: false}));
        return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
        authenticated: true,
        disabled: false,
        user
    }));
}
