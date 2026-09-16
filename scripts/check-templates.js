/* Validate template wiring against the schematic jack map */
const fs = require('fs');
const path = require('path');

const ANALOG_ASSIGN = ['A1', 'A2', 'A3', 'A4'];
const DIGITAL_ASSIGN = ['D4', 'D13', '3D', 'A1', 'A2', 'A3', 'A4'];

const kindOf = {
    led: 'digital', buzz: 'digital', oled: 'i2c', servo: 'digital', dc: 'motor',
    pump: 'digital', relay: 'digital', rgb: 'digital',
    ldr: 'analog', soil: 'analog', gas: 'analog', flame: 'analog', sound: 'analog',
    pulse: 'analog', pot: 'analog',
    btn: 'digital', ultra: 'digital', dht: 'digital', pir: 'digital'
};

const assign = ids => {
    const used = {};
    return ids.map(moduleId => {
        const kind = kindOf[moduleId];
        if (!kind) {
            throw new Error(`unknown ${moduleId}`);
        }
        let portId = null;
        if (kind === 'i2c') {
            portId = used.I2C ? null : 'I2C';
        } else if (kind === 'motor') {
            portId = used.MD ? null : 'MD';
        } else if (kind === 'analog') {
            portId = ANALOG_ASSIGN.find(id => !used[id]);
        } else {
            portId = DIGITAL_ASSIGN.find(id => !used[id]);
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
while ((m = re.exec(text))) {
    count += 1;
    const ids = m[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    try {
        assign(ids);
    } catch (err) {
        errors.push(`${ids.join(',')} — ${err.message}`);
    }
}

console.log('module lists', count);
console.log('errors', errors.length);
errors.forEach(e => console.log(' ', e));
if (errors.length) {
    process.exitCode = 1;
}
