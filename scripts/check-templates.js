/* Validate template wiring without full webpack */
const fs = require('fs');
const path = require('path');

const DIGITAL = ['D4', 'D5', 'D13', 'SPARE1', 'SPARE2'];
const ANALOG = ['A1', 'A2', 'A3'];
const signal = {
    led: 'd', buzz: 'd', oled: 'd', servo: 'd', dc: 'd', pump: 'd', relay: 'd', rgb: 'd',
    ldr: 'a', soil: 'a', gas: 'a', flame: 'a', sound: 'a', pulse: 'a', pot: 'a',
    btn: 'd', ultra: 'd', dht: 'd', pir: 'd'
};

const text = fs.readFileSync(path.join(__dirname, '../src/beginner-studio/domain/templates.js'), 'utf8');
const re = /modules:\s*\[([^\]]+)\]/g;
let m;
const errors = [];
let count = 0;
while ((m = re.exec(text))) {
    count += 1;
    const ids = m[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
    let d = 0;
    let a = 0;
    ids.forEach(id => {
        const t = signal[id];
        if (!t) {
            errors.push(`unknown ${id}`);
            return;
        }
        if (t === 'a') {
            a += 1;
        } else {
            d += 1;
        }
    });
    if (d > 5 || a > 3) {
        errors.push(`${ids.join(',')} → digital=${d} analog=${a}`);
    }
}
console.log('module lists', count);
console.log('errors', errors.length);
errors.forEach(e => console.log(' ', e));
