const DEV_ORIGINS = ['http://127.0.0.1:8601', 'http://localhost:8601'];
const PROD_ORIGINS = ['https://www.tinkerbit.io', 'https://tinkerbit.io'];

const list = value => String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const int = (env, name, fallback, min, max, errors) => {
    const raw = env[name];
    if (raw === undefined || raw === '') {
        return fallback;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
        errors.push(`${name} must be an integer between ${min} and ${max}`);
        return fallback;
    }
    return n;
};

/**
 * Read and validate configuration. Throws one error listing every problem so a
 * misconfigured deploy fails at start instead of at the first request.
 * @param {object} env process.env-like object
 * @returns {object} frozen config
 */
export function loadConfig (env = process.env) {
    const errors = [];
    const production = env.NODE_ENV === 'production';
    const authDisabled = (env.AUTH_DISABLED === '1' || env.AUTH_DISABLED === 'true');
    if (authDisabled && production) {
        errors.push('AUTH_DISABLED cannot be used with NODE_ENV=production');
    }
    const authSecret = env.AUTH_SECRET || '';
    if (!authDisabled && authSecret.length < 32) {
        errors.push('AUTH_SECRET must be at least 32 characters (same value as the Vercel site)');
    }

    const brokerMode = env.IOT_BROKER_MODE || 'mosquitto';
    if (!['mosquitto', 'none'].includes(brokerMode)) {
        errors.push('IOT_BROKER_MODE must be "mosquitto" or "none"');
    }
    if (brokerMode === 'none' && production) {
        errors.push('IOT_BROKER_MODE=none is only for local development');
    }
    if (brokerMode === 'mosquitto') {
        ['MQTT_INGEST_USER', 'MQTT_INGEST_PASS', 'MQTT_ADMIN_USER', 'MQTT_ADMIN_PASS'].forEach(name => {
            if (!env[name]) {
                errors.push(`${name} is required when IOT_BROKER_MODE=mosquitto`);
            }
        });
        if (production && env.MQTT_INGEST_PASS && env.MQTT_INGEST_PASS.length < 24) {
            errors.push('MQTT_INGEST_PASS must be at least 24 characters');
        }
        if (production && env.MQTT_ADMIN_PASS && env.MQTT_ADMIN_PASS.length < 24) {
            errors.push('MQTT_ADMIN_PASS must be at least 24 characters');
        }
    }

    const origins = list(env.IOT_ALLOWED_ORIGINS);
    const allowedOrigins = origins.length ? origins : (production ? PROD_ORIGINS : PROD_ORIGINS.concat(DEV_ORIGINS));
    const allowlistRaw = env.IOT_ALLOWLIST === undefined ? (production ? '' : '*') : env.IOT_ALLOWLIST;

    const config = {
        production,
        enabled: env.IOT_ENABLED === undefined ? true : env.IOT_ENABLED === '1' || env.IOT_ENABLED === 'true',
        host: env.IOT_HOST || '127.0.0.1',
        port: int(env, 'IOT_PORT', 20114, 0, 65535, errors),
        dbPath: env.IOT_DB_PATH || (production ? '/var/lib/tinkerbit-iot/iot.db' : './data/iot.db'),
        authSecret,
        authDisabled,
        allowedOrigins,
        allowAll: allowlistRaw.trim() === '*',
        allowlist: new Set(list(allowlistRaw).filter(e => e !== '*')
            .map(e => e.toLowerCase())),
        brokerMode,
        mqtt: {
            url: env.MQTT_URL || 'mqtt://127.0.0.1:1883',
            ingestUser: env.MQTT_INGEST_USER || '',
            ingestPass: env.MQTT_INGEST_PASS || '',
            adminUser: env.MQTT_ADMIN_USER || '',
            adminPass: env.MQTT_ADMIN_PASS || ''
        },
        publicBroker: {
            host: env.IOT_PUBLIC_HOST || 'api.tinkerbit.io',
            mqttsPort: int(env, 'IOT_PUBLIC_MQTTS_PORT', 8883, 1, 65535, errors),
            wssPath: env.IOT_PUBLIC_WSS_PATH || '/mqtt'
        },
        liveUrl: env.IOT_LIVE_URL ||
            (production ? 'wss://api.tinkerbit.io/iot/v1/live' : `ws://127.0.0.1:${env.IOT_PORT || 20114}/iot/v1/live`),
        limits: {
            maxDevicesPerUser: int(env, 'IOT_MAX_DEVICES_PER_USER', 10, 1, 1000, errors),
            maxCreatesPerDay: int(env, 'IOT_MAX_CREATES_PER_DAY', 10, 1, 1000, errors),
            minIntervalSec: int(env, 'IOT_MIN_INTERVAL_SEC', 5, 1, 3600, errors),
            defaultIntervalSec: int(env, 'IOT_DEFAULT_INTERVAL_SEC', 10, 1, 3600, errors),
            maxIntervalSec: 3600,
            userRequestsPerMinute: int(env, 'IOT_USER_RPM', 120, 10, 10000, errors),
            liveSocketsPerUser: int(env, 'IOT_LIVE_SOCKETS_PER_USER', 5, 1, 50, errors),
            maxRulesPerDevice: 10,
            maxWidgets: 24,
            offlineGraceSec: int(env, 'IOT_OFFLINE_GRACE_SEC', 60, 0, 3600, errors),
            purgeAfterDays: 7
        },
        backup: {
            dir: env.IOT_BACKUP_DIR || '/var/backups/tinkerbit-iot',
            s3Uri: env.IOT_BACKUP_S3_URI || '',
            keepLocal: int(env, 'IOT_BACKUP_KEEP_LOCAL', 7, 1, 90, errors),
            extraFiles: list(env.IOT_BACKUP_EXTRA_FILES)
        }
    };
    if (config.limits.defaultIntervalSec < config.limits.minIntervalSec) {
        errors.push('IOT_DEFAULT_INTERVAL_SEC must be >= IOT_MIN_INTERVAL_SEC');
    }
    if (errors.length) {
        const err = new Error(`Invalid configuration:\n - ${errors.join('\n - ')}`);
        err.code = 'CONFIG_INVALID';
        throw err;
    }
    return Object.freeze(config);
}
