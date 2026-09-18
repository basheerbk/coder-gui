/* Validate template wiring against the schematic jack map */
const fs = require('fs');
const path = require('path');

const ANALOG_ASSIGN = ['A1', 'A2', 'A3', 'A4'];
const DIGITAL_ASSIGN = ['D5', 'D13', '3D', 'A1', 'A2', 'A3', 'A4'];

/** Kit module → jack kind (mirrors ports.js pickPortForModule). */
const kindOf = {
    btn: 'digital',
    pot: 'analog',
    led: 'digital',
    relay: 'digital',
    servo: 'digital',
    l293d: 'motor',
    stepper: 'stepper',
    oled: 'i2c',
    mq2: 'analog',
    mic: 'analog',
    pulse: 'analog',
    soil: 'analog',
    dht: 'digital',
    ultra: 'ultra',
    rfid: 'spi',
    ble: 'onboard'
};

const assign = ids => {
    const used = {};
    return ids.map(moduleId => {
        const kind = kindOf[moduleId];
        if (!kind) {
            throw new Error(`unknown ${moduleId}`);
        }
        let portId = null;
        if (kind === 'onboard') {
            portId = used.ONBOARD ? null : 'ONBOARD';
        } else if (kind === 'i2c') {
            portId = used.I2C ? null : 'I2C';
        } else if (kind === 'motor') {
            portId = used.MD ? null : 'MD';
        } else if (kind === 'stepper') {
            portId = used.STEPPER ? null : 'STEPPER';
        } else if (kind === 'ultra') {
            portId = used.D5 ? null : 'D5';
        } else if (kind === 'spi') {
            if (used.D13) {
                throw new Error('RFID 3D conflicts with D13 (IO33)');
            }
            portId = used['3D'] ? null : '3D';
        } else if (kind === 'analog') {
            portId = ANALOG_ASSIGN.find(id => !used[id]);
        } else {
            // Prefer D13 then analogs; never D5 (HC-SR04 only); skip D13 if 3D used
            const dig = ['D13', 'A1', 'A2', 'A3', 'A4'].filter(id => {
                if (used[id]) {
                    return false;
                }
                if (id === 'D13' && used['3D']) {
                    return false;
                }
                return true;
            });
            portId = dig[0] || null;
        }
        if (!portId) {
            throw new Error(`no jack for ${moduleId}`);
        }
        used[portId] = true;
        return portId;
    });
};

const text = fs.readFileSync(path.join(__dirname, '../src/beginner-studio/domain/templates.js'), 'utf8');
const re = /modules:\s*\[([^\]]+)\]/g;
let m;
const errors = [];
let count = 0;
let skipped = 0;
while ((m = re.exec(text))) {
    const raw = m[1];
    // Only validate static string module lists (skip expandPairs generators).
    if (/[^',\s\w-]/.test(raw) || /\bid\b/.test(raw) || !/'[^']+'/.test(raw)) {
        skipped += 1;
        continue;
    }
    const ids = raw.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    if (!ids.length || ids.some(id => !kindOf[id])) {
        // Dynamic or unknown — skip generator lines
        if (ids.some(id => !kindOf[id] && !/^[a-z0-9-]+$/.test(id))) {
            skipped += 1;
            continue;
        }
    }
    count += 1;
    try {
        assign(ids);
    } catch (err) {
        errors.push(`${ids.join(',')} — ${err.message}`);
    }
}

console.log('module lists', count, '(skipped dynamic', skipped + ')');
console.log('errors', errors.length);
errors.forEach(e => console.log(' ', e));
if (errors.length) {
    process.exitCode = 1;
}
