const fs = require('fs');
const path = require('path');

const srcPath = path.join(
    __dirname,
    '../node_modules/openblock-vm/src/devices/arduinoUno/arduinoUno.js'
);
const outPath = path.join(__dirname, '../src/lib/device-msgs-arduino-uno.json');

const src = fs.readFileSync(srcPath, 'utf8');
const msgs = {};
const re = /id:\s*'([^']+)'\s*,\s*default:\s*'((?:\\'|[^'])*)'/g;
let m;
while ((m = re.exec(src))) {
    msgs[m[1]] = m[2].replace(/\\'/g, "'");
}

fs.writeFileSync(outPath, `${JSON.stringify(msgs, null, 2)}\n`);
console.log(`Wrote ${Object.keys(msgs).length} messages to ${outPath}`);
