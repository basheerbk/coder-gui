const REDACT = new Set(['token', 'password', 'pass', 'authorization', 'cookie', 'ticket', 'secret']);

const scrub = value => {
    if (!value || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(scrub);
    }
    const out = {};
    Object.keys(value).forEach(key => {
        out[key] = REDACT.has(key.toLowerCase()) ? '[redacted]' : scrub(value[key]);
    });
    return out;
};

const write = (level, event, detail) => {
    const line = Object.assign({level, event, ts: new Date().toISOString()}, scrub(detail || {}));
    const text = JSON.stringify(line);
    if (level === 'error' || level === 'warn') {
        process.stderr.write(`${text}\n`);
    } else if (process.env.IOT_LOG_SILENT !== '1') {
        process.stdout.write(`${text}\n`);
    }
};

export const log = {
    info: (event, detail) => write('info', event, detail),
    warn: (event, detail) => write('warn', event, detail),
    error: (event, detail) => {
        const d = Object.assign({}, detail);
        if (d.err instanceof Error) {
            d.err = {message: d.err.message, code: d.err.code, stack: d.err.stack};
        }
        write('error', event, d);
    }
};
