/**
 * Browser storage for Cloud secrets, namespaced per signed-in account so a shared lab PC
 * never hands one student's device key to another.
 *  - device key: localStorage (losing it means regenerating, which breaks the old board)
 *  - WiFi: sessionStorage unless the student ticks "remember on this computer"
 */
import {cEscape} from './cText';

const PREFIX = 'tb_cloud';

const ns = email => `${PREFIX}:${String(email || 'local').toLowerCase()}`;

const store = kind => {
    try {
        return kind === 'session' ? window.sessionStorage : window.localStorage;
    } catch (err) {
        return null;
    }
};

const read = (kind, key) => {
    const s = store(kind);
    if (!s) {
        return null;
    }
    try {
        return s.getItem(key);
    } catch (err) {
        return null;
    }
};

const write = (kind, key, value) => {
    const s = store(kind);
    if (!s) {
        return false;
    }
    try {
        if (value === null || value === undefined) {
            s.removeItem(key);
        } else {
            s.setItem(key, value);
        }
        return true;
    } catch (err) {
        return false;
    }
};

const readJson = (kind, key) => {
    const raw = read(kind, key);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        return null;
    }
};

const readToken = (email, deviceId) => (deviceId ? read('local', `${ns(email)}:token:${deviceId}`) : null);
const writeToken = (email, deviceId, token) => write('local', `${ns(email)}:token:${deviceId}`, token || null);

const readWifi = email => {
    const session = readJson('session', `${ns(email)}:wifi`);
    if (session) {
        return {ssid: session.ssid || '', password: session.password || '', remember: false};
    }
    const saved = readJson('local', `${ns(email)}:wifi`);
    if (saved) {
        return {ssid: saved.ssid || '', password: saved.password || '', remember: true};
    }
    return {ssid: '', password: '', remember: false};
};

const writeWifi = (email, {ssid, password}, remember) => {
    const value = JSON.stringify({ssid: ssid || '', password: password || ''});
    if (remember) {
        write('local', `${ns(email)}:wifi`, value);
        write('session', `${ns(email)}:wifi`, null);
    } else {
        write('session', `${ns(email)}:wifi`, value);
        write('local', `${ns(email)}:wifi`, null);
    }
};

const readLastDevice = email => readJson('local', `${ns(email)}:last`);
const writeLastDevice = (email, cloud) => write('local', `${ns(email)}:last`, cloud ? JSON.stringify({
    deviceId: cloud.deviceId,
    deviceName: cloud.deviceName,
    intervalSec: cloud.intervalSec
}) : null);

/** Everything the upload handler needs, or null pieces when missing. */
const readSecrets = (email, deviceId) => {
    const wifi = readWifi(email);
    return {ssid: wifi.ssid, password: wifi.password, token: readToken(email, deviceId)};
};

/** Remove every Cloud value stored for this account on this browser. */
const forgetAll = email => {
    ['local', 'session'].forEach(kind => {
        const s = store(kind);
        if (!s) {
            return;
        }
        const prefix = `${ns(email)}:`;
        const keys = [];
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (key && key.indexOf(prefix) === 0) {
                keys.push(key);
            }
        }
        keys.forEach(key => write(kind, key, null));
    });
};

/** Replace secret values in text shown to the student (compile logs). */
const maskSecrets = (text, secrets) => {
    let out = String(text || '');
    if (!secrets) {
        return out;
    }
    [secrets.token, secrets.password].forEach(secret => {
        if (secret && secret.length >= 4) {
            // The sketch holds the C-escaped form, so compiler output may echo either.
            [secret, cEscape(secret)].forEach(form => {
                out = out.split(form).join('********');
            });
        }
    });
    return out;
};

export {
    forgetAll,
    maskSecrets,
    readLastDevice,
    readSecrets,
    readToken,
    readWifi,
    writeLastDevice,
    writeToken,
    writeWifi
};
