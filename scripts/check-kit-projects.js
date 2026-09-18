/* Expand kit project specs the same way templates.js does, then validate jacks. */
const ANALOG_ASSIGN = ['A1', 'A2', 'A3', 'A4'];
const DIGITAL_ASSIGN = ['D5', 'D13', 'A1', 'A2', 'A3', 'A4'];

const kindOf = {
    btn: 'digital', pot: 'analog', led: 'digital', relay: 'digital', servo: 'digital',
    l293d: 'motor', relay4: 'motor', stepper: 'stepper', oled: 'i2c', mq2: 'analog', mic: 'analog',
    pulse: 'i2c', soil: 'analog', dht: 'digital', ultra: 'ultra', rfid: 'spi', ble: 'onboard'
};

const assign = ids => {
    const used = {};
    ids.forEach(moduleId => {
        const kind = kindOf[moduleId];
        if (!kind) {
            throw new Error(`unknown ${moduleId}`);
        }
        let portId = null;
        if (kind === 'onboard') {
            portId = used.ONBOARD ? null : 'ONBOARD';
        } else if (kind === 'i2c') {
            // Shared I2C bus (OLED + HW-605)
            portId = 'I2C';
        } else if (kind === 'motor') {
            portId = used.MD ? null : 'MD';
        } else if (kind === 'stepper') {
            portId = used.STEPPER ? null : 'STEPPER';
        } else if (kind === 'ultra') {
            portId = used.D5 ? null : 'D5';
        } else if (kind === 'spi') {
            if (used.D13) {
                throw new Error(`RFID conflicts with D13 in ${ids.join(',')}`);
            }
            portId = used['3D'] ? null : '3D';
        } else if (kind === 'analog') {
            portId = ANALOG_ASSIGN.find(id => !used[id]);
        } else {
            portId = ['D13', 'A1', 'A2', 'A3', 'A4'].find(id => {
                if (used[id]) {
                    return false;
                }
                if (id === 'D13' && used['3D']) {
                    return false;
                }
                return true;
            }) || null;
        }
        if (!portId) {
            throw new Error(`no jack for ${moduleId} in ${ids.join(',')}`);
        }
        if (kind !== 'i2c') {
            used[portId] = true;
        } else {
            used[portId] = true;
        }
    });
};

const SENSOR_GATES = [
    {id: 'pot', op: '>', value: 2000, difficulty: 'Beginner'},
    {id: 'soil', op: '>', value: 2500, difficulty: 'Beginner'},
    {id: 'mq2', op: '>', value: 700, difficulty: 'Beginner'},
    {id: 'mic', op: '>', value: 600, difficulty: 'Beginner'},
    {id: 'pulse', op: '>', value: 100, difficulty: 'Medium'},
    {id: 'ultra', op: '<', value: 25, difficulty: 'Medium'},
    {id: 'dht', op: '>', value: 30, difficulty: 'Medium'}
];

const OUT_ACTIONS = [
    {id: 'led'}, {id: 'relay', burst: true}, {id: 'servo'}, {id: 'l293d'}, {id: 'oled', display: true}
];

const featured = [
    ['led'], ['btn', 'led'], ['btn', 'servo', 'led'], ['btn', 'relay'],
    ['soil', 'relay'], ['dht', 'oled'], ['ultra', 'led'], ['pot', 'l293d'],
    ['pot', 'servo'], ['pulse', 'oled'], ['ultra', 'servo'], ['btn', 'stepper'],
    ['rfid', 'oled'], ['rfid', 'servo', 'led'], ['ble']
];

const extra = [
    ['btn', 'relay', 'led'], ['btn', 'servo'], ['btn', 'l293d'], ['btn', 'stepper', 'led'],
    ['pot', 'led'], ['pot', 'relay'], ['pot', 'oled'], ['dht', 'l293d'], ['dht', 'relay'],
    ['dht', 'led'], ['soil', 'led'], ['soil', 'servo'], ['mic', 'led'], ['mic', 'servo'],
    ['mic', 'l293d'], ['mq2', 'led'], ['mq2', 'servo'], ['mq2', 'l293d'], ['pulse', 'led'],
    ['pulse', 'relay'], ['ultra', 'relay'], ['ultra', 'l293d'], ['ultra', 'oled'],
    ['rfid', 'relay'], ['rfid', 'led'], ['rfid', 'servo', 'oled'], ['ble', 'oled'],
    ['ble', 'led'], ['btn', 'stepper'], ['soil', 'oled'], ['mq2', 'oled'], ['mic', 'oled']
];

const advanced = [
    ['soil', 'dht', 'relay', 'oled', 'led'],
    ['ultra', 'mic', 'led', 'oled'],
    ['dht', 'l293d', 'led', 'oled'],
    ['mq2', 'oled', 'relay', 'led'],
    ['btn', 'pot', 'led', 'servo', 'oled'],
    ['rfid', 'btn', 'servo', 'led', 'oled'],
    ['pulse', 'oled', 'led'],
    ['btn', 'stepper', 'led'],
    ['mic', 'pot', 'led', 'servo', 'oled'],
    ['soil', 'l293d', 'led', 'oled'],
    ['ultra', 'rfid', 'servo', 'led'],
    ['soil', 'relay', 'ble', 'oled'],
    ['dht', 'servo', 'led', 'oled'],
    ['mq2', 'stepper', 'led'],
    ['pulse', 'mic', 'oled', 'led'],
    ['btn', 'led', 'servo', 'oled']
];

const pairs = [];
SENSOR_GATES.forEach(sensor => {
    OUT_ACTIONS.forEach(out => {
        if (sensor.id === 'dht' && out.display) {
            return;
        }
        if (out.display) {
            pairs.push([sensor.id, 'oled']);
            return;
        }
        pairs.push([sensor.id, out.id]);
    });
});

const all = featured.concat(extra).concat(pairs).concat(advanced);
const errors = [];
all.forEach(ids => {
    try {
        assign(ids);
    } catch (err) {
        errors.push(err.message);
    }
});

console.log('projects checked', all.length);
console.log('errors', errors.length);
errors.forEach(e => console.log(' ', e));
if (errors.length) {
    process.exitCode = 1;
}
