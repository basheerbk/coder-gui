const LOGIN_PATH = '/login';

const isLocalHost = () => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
};

const safeIdeNext = () => {
    const path = `${window.location.pathname}${window.location.search}` || '/ide';
    if (
        path === '/ide' ||
        path === '/ide.html' ||
        path.indexOf('/ide/') === 0 ||
        path === '/beginner' ||
        path === '/beginner/' ||
        path === '/beginner.html'
    ) {
        return path === '/beginner/' ? '/beginner' : path;
    }
    return '/ide';
};

/**
 * Ensure the visitor has a TinkerBit session before booting the IDE.
 * Redirects to /login on 401. On local dev with no auth API, continues with a warning.
 * @returns {Promise<object|null>} session payload or null when redirecting
 */
const ensureIdeAuth = () => fetch('/api/auth/me', {
    credentials: 'same-origin',
    headers: {Accept: 'application/json'}
})
    .then(res => {
        if (res.status === 401) {
            window.location.replace(
                `${LOGIN_PATH}?next=${encodeURIComponent(safeIdeNext())}`
            );
            return null;
        }
        if (!res.ok) {
            if (isLocalHost()) {
                // eslint-disable-next-line no-console
                console.warn('Auth API unavailable; continuing in local dev mode.');
                return {authenticated: false, disabled: true, localBypass: true};
            }
            window.location.replace(`${LOGIN_PATH}?error=config`);
            return null;
        }
        return res.json();
    })
    .catch(() => {
        if (isLocalHost()) {
            // eslint-disable-next-line no-console
            console.warn('Auth API unreachable; continuing in local dev mode.');
            return {authenticated: false, disabled: true, localBypass: true};
        }
        window.location.replace(`${LOGIN_PATH}?error=config`);
        return null;
    });

const fetchAuthMe = () => fetch('/api/auth/me', {
    credentials: 'same-origin',
    headers: {Accept: 'application/json'}
}).then(res => {
    if (!res.ok) {
        return {authenticated: false};
    }
    return res.json();
}).catch(() => ({authenticated: false}));

const logout = () => fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin'
}).then(() => {
    window.location.assign(LOGIN_PATH);
}).catch(() => {
    window.location.assign(LOGIN_PATH);
});

export {
    ensureIdeAuth,
    fetchAuthMe,
    logout
};
