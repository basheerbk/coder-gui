import Clarity from '@microsoft/clarity';

import log from './log';

const CLARITY_ID = process.env.CLARITY_ID || (typeof window !== 'undefined' && window.CLARITY_ID);

let initialized = false;

const isEnabled = () => initialized && Boolean(CLARITY_ID) &&
    CLARITY_ID !== 'undefined' && CLARITY_ID !== '';

/**
 * Initialize Microsoft Clarity for session replay / heatmaps.
 * No-ops when CLARITY_ID is missing.
 * @param {string=} pageTag optional page tag (landing|login|ide)
 */
const initialClarity = (pageTag) => {
    if (!CLARITY_ID || CLARITY_ID === 'undefined' || CLARITY_ID === '') {
        log.info('Disabling Clarity because CLARITY_ID is not set.');
        return;
    }
    try {
        Clarity.init(String(CLARITY_ID));
        initialized = true;
        if (pageTag) {
            setClarityTag('page', pageTag);
        }
    } catch (err) {
        log.warn('Clarity init failed', err);
    }
};

/**
 * Tag the current session for filtering in the Clarity dashboard.
 * @param {string} key
 * @param {string|string[]} value
 */
const setClarityTag = (key, value) => {
    if (!isEnabled() || !key || value == null || value === '') {
        return;
    }
    try {
        Clarity.setTag(String(key), value);
    } catch (err) {
        log.warn('Clarity setTag failed', err);
    }
};

/**
 * Record a named custom event.
 * @param {string} name
 */
const clarityEvent = (name) => {
    if (!isEnabled() || !name) {
        return;
    }
    try {
        Clarity.event(String(name));
    } catch (err) {
        log.warn('Clarity event failed', err);
    }
};

/**
 * Prioritize recording this session (useful for rare / high-value actions).
 * @param {string} reason
 */
const upgradeClaritySession = (reason) => {
    if (!isEnabled() || !reason) {
        return;
    }
    try {
        Clarity.upgrade(String(reason));
    } catch (err) {
        log.warn('Clarity upgrade failed', err);
    }
};

/**
 * Link Clarity sessions to the signed-in Google user (hashed client-side).
 * @param {object|null|undefined} session /api/auth/me payload
 */
const identifyClarityUser = (session) => {
    if (!isEnabled() || !session || !session.authenticated || !session.user) {
        return;
    }
    const user = session.user;
    const customId = user.sub || user.email;
    if (!customId) {
        return;
    }
    try {
        Clarity.identify(
            String(customId),
            undefined,
            undefined,
            user.name ? String(user.name) : undefined
        );
        setClarityTag('signed_in', 'true');
        if (session.disabled || session.localBypass) {
            setClarityTag('auth_mode', 'local_bypass');
        } else {
            setClarityTag('auth_mode', 'google');
        }
    } catch (err) {
        log.warn('Clarity identify failed', err);
    }
};

export {
    Clarity as default,
    initialClarity,
    setClarityTag,
    clarityEvent,
    upgradeClaritySession,
    identifyClarityUser
};
