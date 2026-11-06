import {kindById} from './aiKinds';

const MAX_FEATURES = 64;

/**
 * One line from the Edge AI recorder sketch, or null for anything else the board prints.
 *   TBAI1,H,<kind>,<signature>,<feature count>   hello, every 2 s
 *   TBAI1,F,<f1>,<f2>,...                        one example (a move, or one second of readings)
 *   TBAI1,L,<0-100>                              how much it is moving (50 starts a move)
 *   TBAI1,E,<code>                               a problem, e.g. no_sensor
 */
const parseAiLine = line => {
    const text = String(line || '').trim();
    if (text.indexOf('TBAI1,') !== 0) {
        return null;
    }
    const parts = text.split(',');
    if (parts[1] === 'H' && parts.length === 5) {
        const n = Number(parts[4]);
        if (!kindById(parts[2]) || !/^[a-z]+:[A-Za-z0-9+]*$/.test(parts[3]) ||
            !Number.isInteger(n) || n < 1 || n > MAX_FEATURES) {
            return null;
        }
        return {type: 'hello', kind: parts[2], sig: parts[3], n};
    }
    if (parts[1] === 'F' && parts.length > 2 && parts.length - 2 <= MAX_FEATURES) {
        const f = parts.slice(2).map(v => (v.trim() === '' ? NaN : Number(v)));
        if (f.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) {
            return null;
        }
        return {type: 'example', f};
    }
    if (parts[1] === 'L' && parts.length === 3) {
        const value = Number(parts[2]);
        return Number.isFinite(value) ? {type: 'level', value: Math.max(0, Math.min(100, Math.round(value)))} : null;
    }
    if (parts[1] === 'E' && parts.length === 3 && /^[a-z_]{1,24}$/.test(parts[2])) {
        return {type: 'error', code: parts[2]};
    }
    return null;
};

export {parseAiLine};
