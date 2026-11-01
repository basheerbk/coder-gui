import {cEscape, utf8Bytes} from './cText';
import {moduleById} from './modules';
import {CLOUD_LOCKED_PORTS, CLOUD_LOCK_HINT, portById} from './ports';

const CLOUD_DEFAULTS = {
    host: 'api.tinkerbit.io',
    mqttsPort: 8883,
    wssPath: '/mqtt',
    intervalSec: 10,
    minIntervalSec: 5
};

const DEVICE_ID_RE = /^d_[a-z2-9]{10}$/;
const DEVICE_TOKEN_RE = /^tbd_[A-Za-z0-9_-]{43}$/;
const MASK = '********';

const CLOUD_SWITCHES = [1, 2, 3, 4].map(n => ({id: `cloudSwitch${n}`, key: `switch${n}`, label: `Dashboard switch ${n}`, boolean: true}));
const CLOUD_SLIDERS = [1, 2].map(n => ({id: `cloudSlider${n}`, key: `slider${n}`, label: `Dashboard slider ${n} (0–100)`, boolean: false, defaultValue: 50}));
const CLOUD_CONTROL_OPTIONS = CLOUD_SWITCHES.concat(CLOUD_SLIDERS);

const isCloudModuleId = id => {
    const mod = moduleById(id);
    return Boolean(mod && mod.id === 'cloud');
};

const hasCloud = connections => (connections || []).some(c => isCloudModuleId(c.moduleId));
const hasBle = connections => (connections || []).some(c => {
    const mod = moduleById(c.moduleId);
    return Boolean(mod && mod.id === 'ble');
});

const isCloudLockedPort = portId => CLOUD_LOCKED_PORTS.indexOf(portId) !== -1;

/** Parts plugged into A1–A4 (they block adding Cloud, or break a stale saved state). */
const lockedPortParts = connections => (connections || [])
    .filter(c => isCloudLockedPort(c.portId))
    .map(c => {
        const mod = moduleById(c.moduleId);
        const port = portById(c.portId);
        return {
            connection: c,
            name: mod ? mod.name : c.moduleId,
            port: port ? port.label : c.portId
        };
    });

const unplugHint = parts => {
    if (!parts.length) {
        return null;
    }
    const first = parts[0];
    const more = parts.length > 1 ? ` (and ${parts.length - 1} more on A1–A4)` : '';
    return `Unplug ${first.name} from ${first.port} first${more} — A1–A4 switch off when Cloud is on`;
};

/** Why Cloud cannot be added right now, or null. */
const cloudAddProblem = connections => {
    if (hasBle(connections)) {
        return 'Cloud and Bluetooth (BLE) cannot run together — remove Bluetooth first';
    }
    return unplugHint(lockedPortParts(connections));
};

const validateWifi = ({ssid, password} = {}) => {
    const errors = {};
    const name = typeof ssid === 'string' ? ssid : '';
    const pass = typeof password === 'string' ? password : '';
    const nameBytes = utf8Bytes(name).length;
    const passBytes = utf8Bytes(pass).length;
    if (!name.trim()) {
        errors.ssid = 'Type the WiFi name';
    } else if (nameBytes > 32) {
        errors.ssid = 'WiFi names are at most 32 characters';
    }
    if (pass && (passBytes < 8 || passBytes > 63)) {
        errors.password = 'WiFi passwords are 8–63 characters (leave empty for an open network)';
    }
    return {ok: Object.keys(errors).length === 0, errors};
};

const clampInterval = (value, min = CLOUD_DEFAULTS.minIntervalSec) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) {
        return CLOUD_DEFAULTS.intervalSec;
    }
    return Math.max(min, Math.min(3600, n));
};

/**
 * Everything that must be true before a Cloud sketch can be uploaded.
 * Returns a kid-readable message, or null when ready.
 */
const cloudUploadProblem = (connections, cloud, secrets) => {
    if (!hasCloud(connections)) {
        return null;
    }
    if (hasBle(connections)) {
        return 'Remove Bluetooth (BLE): it cannot run together with Cloud';
    }
    const locked = lockedPortParts(connections);
    if (locked.length) {
        return unplugHint(locked);
    }
    if (!cloud || !cloud.deviceId) {
        return 'Set up Cloud first: pick or create a device';
    }
    if (!DEVICE_ID_RE.test(cloud.deviceId)) {
        return 'This Cloud device id looks wrong — pick the device again';
    }
    if (!secrets || !DEVICE_TOKEN_RE.test(secrets.token || '')) {
        return 'This computer does not have the device key — open Cloud setup to get a new one';
    }
    const wifi = validateWifi(secrets);
    if (!wifi.ok) {
        return wifi.errors.ssid || wifi.errors.password;
    }
    return null;
};

export {
    CLOUD_CONTROL_OPTIONS,
    CLOUD_DEFAULTS,
    CLOUD_LOCK_HINT,
    CLOUD_LOCKED_PORTS,
    CLOUD_SLIDERS,
    CLOUD_SWITCHES,
    DEVICE_ID_RE,
    DEVICE_TOKEN_RE,
    MASK,
    cEscape,
    clampInterval,
    cloudAddProblem,
    cloudUploadProblem,
    hasBle,
    hasCloud,
    isCloudLockedPort,
    lockedPortParts,
    unplugHint,
    utf8Bytes,
    validateWifi
};
