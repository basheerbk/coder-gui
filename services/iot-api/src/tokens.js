import crypto from 'node:crypto';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Device ids double as MQTT username and client id: short, lowercase, unambiguous. */
export const DEVICE_ID_RE = /^d_[a-z2-9]{10}$/;
export const TOKEN_RE = /^tbd_[A-Za-z0-9_-]{43}$/;

export function newDeviceId () {
    const bytes = crypto.randomBytes(10);
    let out = 'd_';
    for (let i = 0; i < bytes.length; i++) {
        out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    }
    return out;
}

export function newRuleId () {
    return `r_${crypto.randomBytes(8).toString('hex')}`;
}

/** 256-bit secret; the tbd_ prefix lets secret scanners spot leaked tokens. */
export function newDeviceToken () {
    return `tbd_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashToken (token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function tokenPrefix (token) {
    return String(token).slice(0, 10);
}

export function newTicket () {
    return crypto.randomBytes(32).toString('base64url');
}

export function newSecret (bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
