import {uid} from './ids';
import {moduleById} from './modules';
import {pickPortForModule, portById} from './ports';
import {createBlock} from './tree';

const wire = (moduleId, portId) => {
    const port = portById(portId);
    return {
        id: uid('conn'),
        moduleId,
        portId,
        pin: port ? port.pin : portId
    };
};

const actionBlock = (conn, actionType, params) => {
    const mod = moduleById(conn.moduleId);
    const action = (mod.actions || []).find(a => a.type === actionType);
    return createBlock(actionType, {
        cid: conn.id,
        params: Object.assign({}, action && action.params ? action.params : {}, params || {})
    });
};

const assignWiring = moduleIds => {
    const used = {};
    return moduleIds.map(moduleId => {
        const mod = moduleById(moduleId);
        if (!mod) {
            throw new Error(`Unknown module: ${moduleId}`);
        }
        const portId = pickPortForModule(mod, used);
        if (!portId) {
            throw new Error(`No free jack for ${moduleId} in ${moduleIds.join(',')}`);
        }
        // I2C is a shared bus — do not block a second I2C device.
        if (!(mod.i2c || mod.id === 'oled' || mod.id === 'pulse')) {
            used[portId] = true;
        } else {
            used[portId] = true; // still mark for conflict hints; pickPort allows reuse
        }
        return [moduleId, portId];
    });
};

const buildTemplate = (meta, wiring, buildProgram) => {
    const connections = wiring.map(([moduleId, portId]) => wire(moduleId, portId));
    const byModule = {};
    connections.forEach(c => {
        byModule[c.moduleId] = c;
    });
    return Object.assign({}, meta, {
        connections,
        program: buildProgram(byModule, actionBlock, createBlock)
    });
};

const sensorVar = moduleId => {
    const mod = moduleById(moduleId);
    return mod && mod.valueName ? mod.valueName : 'value';
};

const readAction = moduleId => {
    const mod = moduleById(moduleId);
    if (!mod || !mod.actions || !mod.actions.length) {
        return 'read_value';
    }
    return mod.actions[0].type;
};

const isBoolSensor = moduleId => moduleId === 'btn';

/** Build a kid-ready program from a short pattern id. */
const programFor = (spec, m, act, blk) => {
    const modules = spec.modules;
    const sensor = modules.find(id => {
        const mod = moduleById(id);
        return mod && mod.dir === 'in';
    });
    const outs = modules.filter(id => {
        const mod = moduleById(id);
        return mod && mod.dir === 'out';
    });
    const onOffIds = outs.filter(id => {
        const mod = moduleById(id);
        return mod && (mod.actions || []).some(a => a.type === 'set_on');
    });
    const onOff = onOffIds[0];
    const relay = outs.find(id => id === 'relay');
    const relay4 = outs.find(id => id === 'relay4');
    const oled = outs.find(id => id === 'oled');
    const servo = outs.find(id => id === 'servo');
    const motor = outs.find(id => id === 'l293d');
    const stepper = outs.find(id => id === 'stepper');
    const sensors = modules.filter(id => {
        const mod = moduleById(id);
        return mod && mod.dir === 'in';
    });
    const primary = spec.primary && modules.indexOf(spec.primary) !== -1
        ? spec.primary
        : (sensor || null);

    const op = spec.op || '<';
    const threshold = spec.value != null ? spec.value : 500;
    const waitSec = spec.wait != null
        ? spec.wait
        : ((sensor === 'dht' || primary === 'dht' || modules.indexOf('dht') !== -1)
            ? 2.5
            : ((sensor === 'mq2' || primary === 'mq2') ? 0.5 : 0.2));
    const pattern = spec.pattern;

    if (pattern === 'blink') {
        const target = onOff || outs[0];
        return [
            act(m[target], target === 'led' ? 'blink' : 'set_on', target === 'led' ? {ms: 400} : {on: true}),
            blk('wait', {params: {seconds: waitSec}})
        ];
    }

    if (pattern === 'display') {
        const readMod = sensor || modules[0];
        return [
            act(m[readMod], readAction(readMod)),
            oled ? act(m.oled, 'show_number', {varName: sensorVar(readMod)}) : blk('serial_var', {params: {varName: sensorVar(readMod)}}),
            blk('wait', {params: {seconds: waitSec}})
        ];
    }

    if (pattern === 'display_temp') {
        return [
            act(m.dht, 'print_climate'),
            oled ? act(m.oled, 'show_number', {varName: 'temperature'}) : null,
            blk('wait', {params: {seconds: 2.5}})
        ].filter(Boolean);
    }

    if (pattern === 'display_humid') {
        return [
            act(m.dht, 'print_climate'),
            oled ? act(m.oled, 'show_number', {varName: 'humidity'}) : null,
            blk('wait', {params: {seconds: 2.5}})
        ].filter(Boolean);
    }

    if (pattern === 'pot_motor') {
        return [
            act(m.pot, 'read_value'),
            act(m.l293d, 'motor_speed', {
                speedVar: 'knobValue',
                motor: spec.motor || 'A',
                dir: spec.dir || 'forward'
            }),
            blk('serial_var', {params: {varName: 'knobValue'}}),
            blk('wait', {params: {seconds: 0.1}})
        ];
    }

    if (pattern === 'pot_servo') {
        return [
            act(m.pot, 'read_value'),
            act(m.servo, 'set_angle', {angle: spec.angle != null ? spec.angle : 90}),
            blk('wait', {params: {seconds: 0.1}})
        ];
    }

    if (pattern === 'button_burst') {
        const thenKids = [];
        if (relay) {
            thenKids.push(act(m.relay, 'set_on', {on: true}));
        }
        if (relay4) {
            thenKids.push(act(m.relay4, 'relay_channel', {channel: spec.channel || 1, on: true}));
        }
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: 90}));
        }
        if (motor) {
            thenKids.push(act(m.l293d, 'motor_speed', {speed: spec.speed != null ? spec.speed : 200}));
        }
        if (stepper) {
            thenKids.push(act(m.stepper, 'stepper_move', {steps: spec.steps || 100, rpm: spec.rpm || 12}));
        }
        if (onOff && onOff !== 'relay') {
            thenKids.push(act(m[onOff], 'set_on', {on: true}));
        }
        thenKids.push(blk('wait', {params: {seconds: 0.3}}));
        if (relay) {
            thenKids.push(act(m.relay, 'set_on', {on: false}));
        }
        if (relay4) {
            thenKids.push(act(m.relay4, 'relay_channel', {channel: spec.channel || 1, on: false}));
        }
        if (servo) {
            thenKids.push(blk('wait', {params: {seconds: 1.5}}));
            thenKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (motor) {
            thenKids.push(act(m.l293d, 'motor_stop'));
        }
        if (onOff && onOff !== 'relay') {
            thenKids.push(act(m[onOff], 'set_on', {on: false}));
        }
        return [
            act(m.btn, 'is_pressed'),
            Object.assign(blk('if_then', {params: {sensor: 'buttonState', op: 'is', value: 0}}), {
                children: thenKids,
                elseChildren: []
            })
        ];
    }

    if (pattern === 'relay4_seq') {
        const ch = spec.channel || 1;
        return [
            act(m.relay4, 'relay_channel', {channel: ch, on: true}),
            blk('wait', {params: {seconds: 1}}),
            act(m.relay4, 'relay_channel', {channel: ch, on: false}),
            blk('wait', {params: {seconds: 0.5}})
        ];
    }

    if (pattern === 'relay_burst') {
        return [
            act(m[sensor], readAction(sensor)),
            Object.assign(blk('if_then', {
                params: {sensor: sensorVar(sensor), op, value: threshold}
            }), {
                children: [
                    act(m.relay, 'set_on', {on: true}),
                    blk('wait', {params: {seconds: spec.burst != null ? spec.burst : 2}}),
                    act(m.relay, 'set_on', {on: false})
                ],
                elseChildren: [act(m.relay, 'set_on', {on: false})]
            }),
            blk('wait', {params: {seconds: 1}})
        ];
    }

    if (pattern === 'stepper_demo') {
        const kids = [
            act(m.stepper, 'stepper_move', {steps: spec.steps || 200, rpm: spec.rpm || 12})
        ];
        if (onOff) {
            kids.unshift(act(m[onOff], 'set_on', {on: true}));
            kids.push(blk('wait', {params: {seconds: 0.2}}));
            kids.push(act(m[onOff], 'set_on', {on: false}));
        } else {
            kids.push(blk('wait', {params: {seconds: 0.5}}));
        }
        return [
            act(m.btn, 'is_pressed'),
            Object.assign(blk('if_then', {params: {sensor: 'buttonState', op: 'is', value: 0}}), {
                children: kids,
                elseChildren: []
            })
        ];
    }

    if (pattern === 'rfid_gate') {
        const kids = [];
        if (m.ultra) {
            kids.push(act(m.ultra, 'read_distance'));
        }
        kids.push(act(m.rfid, 'rfid_read'));
        if (oled) {
            kids.push(act(m.oled, 'show_text', {text: spec.thenText || 'Card OK'}));
        } else {
            kids.push(blk('serial_print', {params: {text: 'Card OK'}}));
        }
        const unlock = [];
        if (servo) {
            unlock.push(act(m.servo, 'set_angle', {angle: spec.angle != null ? spec.angle : 90}));
            unlock.push(blk('wait', {params: {seconds: 1.5}}));
            unlock.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (relay) {
            unlock.push(act(m.relay, 'set_on', {on: true}));
            unlock.push(blk('wait', {params: {seconds: 1}}));
            unlock.push(act(m.relay, 'set_on', {on: false}));
        }
        if (onOff && onOff !== 'relay') {
            unlock.push(act(m[onOff], 'set_on', {on: true}));
            unlock.push(blk('wait', {params: {seconds: 0.4}}));
            unlock.push(act(m[onOff], 'set_on', {on: false}));
        }
        if (m.ultra && unlock.length) {
            kids.push(Object.assign(blk('if_then', {
                params: {sensor: 'distance', op: spec.op || '<', value: threshold}
            }), {
                children: unlock,
                elseChildren: []
            }));
        } else {
            unlock.forEach(b => kids.push(b));
        }
        kids.push(blk('wait', {params: {seconds: 0.3}}));
        return kids;
    }

    if (pattern === 'ble_beacon') {
        const lines = [
            act(m.ble, 'ble_advertise', {name: spec.bleName || 'TinkerBit'}),
            act(m.ble, 'ble_send', {text: spec.bleText || 'Hello'})
        ];
        if (oled) {
            lines.push(act(m.oled, 'show_text', {text: spec.thenText || 'BLE on'}));
        }
        if (onOff) {
            lines.push(act(m[onOff], onOff === 'led' ? 'blink' : 'set_on',
                onOff === 'led' ? {ms: 200} : {on: true}));
        }
        lines.push(blk('wait', {params: {seconds: 2}}));
        return lines;
    }

    const pushOutputs = (thenKids, elseKids, opts) => {
        const useBlink = opts && opts.blink;
        onOffIds.forEach(id => {
            thenKids.push(act(m[id], id === 'led' && useBlink ? 'blink' : 'set_on',
                id === 'led' && useBlink ? {ms: 200} : {on: true}));
            elseKids.push(act(m[id], 'set_on', {on: false}));
        });
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: spec.angle != null ? spec.angle : 90}));
            elseKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (motor) {
            thenKids.push(act(m.l293d, 'motor_speed', {speed: spec.speed != null ? spec.speed : 200}));
            elseKids.push(act(m.l293d, 'motor_stop'));
        }
        if (stepper) {
            thenKids.push(act(m.stepper, 'stepper_move', {steps: spec.steps || 100, rpm: spec.rpm || 12}));
        }
        if (oled && !(opts && opts.skipOledMsg)) {
            thenKids.push(act(m.oled, 'show_text', {text: spec.thenText || 'ALERT'}));
            elseKids.push(act(m.oled, 'show_text', {text: spec.elseText || 'OK'}));
        }
    };

    if (pattern === 'advanced_scene') {
        const gate = primary || sensor;
        const lines = sensors.map(id => act(m[id], readAction(id)));
        if (oled && gate) {
            lines.push(act(m.oled, 'show_number', {varName: sensorVar(gate)}));
        }
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {blink: spec.blink, skipOledMsg: true});
        if (spec.burstRelay && m.relay) {
            thenKids.push(act(m.relay, 'set_on', {on: true}));
            thenKids.push(blk('wait', {params: {seconds: spec.burst || 1.5}}));
            thenKids.push(act(m.relay, 'set_on', {on: false}));
        }
        if (m.ble) {
            thenKids.push(act(m.ble, 'ble_advertise', {name: spec.bleName || 'TinkerBit'}));
            thenKids.push(act(m.ble, 'ble_send', {text: spec.bleText || 'ALERT'}));
            elseKids.push(act(m.ble, 'ble_send', {text: spec.elseText || 'OK'}));
        }
        const ifParams = isBoolSensor(gate)
            ? {sensor: sensorVar(gate), op: 'is', value: 0}
            : {sensor: sensorVar(gate), op, value: threshold};
        lines.push(Object.assign(blk('if_then', {params: ifParams}), {
            children: thenKids,
            elseChildren: elseKids
        }));
        lines.push(blk('wait', {params: {seconds: waitSec}}));
        return lines;
    }

    if (pattern === 'command_center') {
        const lines = [];
        if (m.pot) {
            lines.push(act(m.pot, 'read_value'));
            if (oled) {
                lines.push(act(m.oled, 'show_number', {varName: 'knobValue'}));
            }
        }
        if (m.rfid) {
            lines.push(act(m.rfid, 'rfid_read'));
        }
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {blink: true});
        thenKids.push(blk('wait', {params: {seconds: spec.hold != null ? spec.hold : 2}}));
        if (relay) {
            thenKids.push(act(m.relay, 'set_on', {on: false}));
        }
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (motor) {
            thenKids.push(act(m.l293d, 'motor_stop'));
        }
        lines.push(act(m.btn, 'is_pressed'));
        lines.push(Object.assign(blk('if_then', {params: {sensor: 'buttonState', op: 'is', value: 0}}), {
            children: thenKids,
            elseChildren: elseKids
        }));
        return lines;
    }

    if (sensor && outs.length) {
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {blink: spec.blink});
        return [
            act(m[sensor], readAction(sensor)),
            Object.assign(blk('if_then', {
                params: isBoolSensor(sensor)
                    ? {sensor: sensorVar(sensor), op: 'is', value: 0}
                    : {sensor: sensorVar(sensor), op, value: threshold}
            }), {
                children: thenKids,
                elseChildren: elseKids
            }),
            blk('wait', {params: {seconds: waitSec}})
        ];
    }

    if (onOff) {
        return [
            act(m[onOff], onOff === 'led' ? 'blink' : 'set_on', onOff === 'led' ? {ms: 400} : {on: true}),
            blk('wait', {params: {seconds: waitSec}})
        ];
    }

    return [blk('wait', {params: {seconds: 1}})];
};

/**
 * Kit-only Project Library.
 * Modules: btn, relay, relay4 (MD), stepper, mq2, ble, led, mic, pulse (HW-605), oled,
 *          dht, soil, servo, l293d, ultra (HC-SR04), rfid, pot
 */
const SENSOR_GATES = [
    {id: 'pot', label: 'Knob', noun: 'knob', op: '>', value: 2000, difficulty: 'Beginner'},
    {id: 'soil', label: 'Soil', noun: 'soil', op: '<', value: 40, difficulty: 'Beginner'},
    {id: 'mq2', label: 'Gas', noun: 'gas', op: '>', value: 700, difficulty: 'Beginner'},
    {id: 'mic', label: 'Mic', noun: 'sound', op: '>', value: 600, difficulty: 'Beginner'},
    {id: 'pulse', label: 'Pulse', noun: 'heartbeat', op: '>', value: 60, difficulty: 'Medium'},
    {id: 'ultra', label: 'Range', noun: 'distance', op: '<', value: 25, difficulty: 'Medium'},
    {id: 'dht', label: 'Temp', noun: 'temperature', op: '>', value: 30, difficulty: 'Medium'}
];

const OUT_ACTIONS = [
    {id: 'led', label: 'LED', verb: 'lights LED', blink: true},
    {id: 'relay', label: 'Relay', verb: 'clicks relay', burst: true},
    {id: 'servo', label: 'Servo', verb: 'moves servo'},
    {id: 'l293d', label: 'Motor', verb: 'runs motor', speed: 200},
    {id: 'oled', label: 'OLED', verb: 'shows on OLED', display: true}
];

const FEATURED_SPECS = [
    {id: 'led-blink', name: 'LED Blink', description: 'Blink the LED', difficulty: 'Beginner', modules: ['led'], pattern: 'blink'},
    {id: 'button-lamp', name: 'Button Lamp', description: 'Press to light the LED', difficulty: 'Beginner', modules: ['btn', 'led'], pattern: 'button_burst'},
    {id: 'smart-lock', name: 'Smart Lock', description: 'Button unlocks a servo', difficulty: 'Beginner', modules: ['btn', 'servo', 'led'], pattern: 'button_burst'},
    {id: 'relay-switch', name: 'Relay Switch', description: 'Button clicks the relay', difficulty: 'Beginner', modules: ['btn', 'relay'], pattern: 'button_burst'},
    {id: 'md-relay-ch1', name: 'MD Relay CH1', description: 'Button clicks 4-ch relay channel 1 on MD', difficulty: 'Beginner', modules: ['btn', 'relay4'], pattern: 'button_burst', channel: 1},
    {id: 'md-relay-sweep', name: 'MD Relay Sweep', description: 'Cycle 4-ch relay channel 1 on MD', difficulty: 'Beginner', modules: ['relay4'], pattern: 'relay4_seq', channel: 1},
    {id: 'smart-garden', name: 'Smart Garden', description: 'Relay waters when soil moisture is below 40%', difficulty: 'Beginner', modules: ['soil', 'relay'], pattern: 'relay_burst', op: '<', value: 40},
    {id: 'temp-display', name: 'Temp Display', description: 'DHT11 temperature on OLED', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_temp'},
    {id: 'parking-sensor', name: 'Parking Sensor', description: 'HC-SR04 lights LED when close', difficulty: 'Medium', modules: ['ultra', 'led'], op: '<', value: 20, blink: true},
    {id: 'speed-fan', name: 'Speed Fan', description: 'Knob controls L293D motor', difficulty: 'Beginner', modules: ['pot', 'l293d'], pattern: 'pot_motor'},
    {id: 'knob-servo', name: 'Knob Servo', description: 'Aim servo with the knob', difficulty: 'Beginner', modules: ['pot', 'servo'], pattern: 'pot_servo'},
    {id: 'humid-display', name: 'Humidity Display', description: 'DHT11 humidity on OLED', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_humid'},
    {id: 'heart-monitor', name: 'Heart Monitor', description: 'HW-605 pulse on OLED', difficulty: 'Medium', modules: ['pulse', 'oled'], pattern: 'display'},
    {id: 'smart-dustbin', name: 'Smart Dustbin', description: 'Distance opens a servo lid', difficulty: 'Medium', modules: ['ultra', 'servo'], op: '<', value: 25},
    {id: 'stepper-jog', name: 'Stepper Jog', description: 'Button steps the motor', difficulty: 'Medium', modules: ['btn', 'stepper'], pattern: 'stepper_demo'},
    {id: 'rfid-scan', name: 'RFID Scan', description: 'Read RC522 cards on OLED', difficulty: 'Medium', modules: ['rfid', 'oled'], pattern: 'rfid_gate'},
    {id: 'rfid-door', name: 'RFID Door', description: 'Card unlocks a servo', difficulty: 'Medium', modules: ['rfid', 'servo', 'led'], pattern: 'rfid_gate'},
    {id: 'ble-beacon', name: 'BLE Beacon', description: 'Advertise and send over Bluetooth', difficulty: 'Medium', modules: ['ble'], pattern: 'ble_beacon'}
];

const expandPairs = () => {
    const list = [];
    SENSOR_GATES.forEach(sensor => {
        OUT_ACTIONS.forEach(out => {
            if (sensor.id === 'dht' && out.display) {
                return;
            }
            const id = `p-${sensor.id}-${out.id}`;
            if (FEATURED_SPECS.some(s => s.id === id || (s.modules.length === 2 && s.modules[0] === sensor.id && s.modules[1] === out.id))) {
                return;
            }
            if (out.display) {
                list.push({
                    id,
                    name: `${sensor.label} Meter`,
                    description: `Show ${sensor.noun} on OLED`,
                    difficulty: sensor.difficulty,
                    modules: [sensor.id, 'oled'],
                    pattern: 'display'
                });
                return;
            }
            if (out.burst && out.id === 'relay') {
                list.push({
                    id,
                    name: `${sensor.label} Relay`,
                    description: `Relay when ${sensor.noun} crosses limit`,
                    difficulty: sensor.difficulty === 'Beginner' ? 'Medium' : sensor.difficulty,
                    modules: [sensor.id, 'relay'],
                    pattern: 'relay_burst',
                    op: sensor.op,
                    value: sensor.value
                });
                return;
            }
            list.push({
                id,
                name: `${sensor.label} ${out.label}`,
                description: `${out.verb} when ${sensor.noun} crosses limit`,
                difficulty: sensor.difficulty,
                modules: [sensor.id, out.id],
                op: sensor.op,
                value: sensor.value,
                blink: Boolean(out.blink),
                speed: out.speed
            });
        });
    });
    return list;
};

const EXTRA_SPECS = [
    {id: 'btn-relay-led', name: 'Button Power', description: 'Button clicks relay and LED', difficulty: 'Beginner', modules: ['btn', 'relay', 'led'], pattern: 'button_burst'},
    {id: 'btn-servo', name: 'Button Servo', description: 'Press to swing the servo', difficulty: 'Beginner', modules: ['btn', 'servo'], pattern: 'button_burst'},
    {id: 'btn-motor', name: 'Button Motor', description: 'Press to run the L293D', difficulty: 'Beginner', modules: ['btn', 'l293d'], pattern: 'button_burst'},
    {id: 'btn-stepper-led', name: 'Stepper Click', description: 'Button steps motor with LED', difficulty: 'Medium', modules: ['btn', 'stepper', 'led'], pattern: 'stepper_demo'},
    {id: 'pot-led', name: 'Knob Lamp', description: 'LED when knob is high', difficulty: 'Beginner', modules: ['pot', 'led'], op: '>', value: 2000},
    {id: 'pot-relay', name: 'Knob Relay', description: 'Relay when knob is high', difficulty: 'Beginner', modules: ['pot', 'relay'], op: '>', value: 2200},
    {id: 'pot-oled', name: 'Knob Meter', description: 'Show knob value on OLED', difficulty: 'Beginner', modules: ['pot', 'oled'], pattern: 'display'},
    {id: 'hot-fan', name: 'Hot Fan', description: 'Fan when temperature is high', difficulty: 'Medium', modules: ['dht', 'l293d'], op: '>', value: 30, speed: 200},
    {id: 'hot-relay', name: 'Hot Relay', description: 'Relay when room is hot', difficulty: 'Medium', modules: ['dht', 'relay'], pattern: 'relay_burst', op: '>', value: 32},
    {id: 'cool-led', name: 'Cool LED', description: 'LED when temperature is low', difficulty: 'Medium', modules: ['dht', 'led'], op: '<', value: 20},
    {id: 'soil-led', name: 'Dry Soil Lamp', description: 'LED when soil moisture is below 40%', difficulty: 'Beginner', modules: ['soil', 'led'], op: '<', value: 40},
    {id: 'soil-servo', name: 'Soil Gate', description: 'Servo when soil moisture is below 40%', difficulty: 'Medium', modules: ['soil', 'servo'], op: '<', value: 40},
    {id: 'clap-lamp', name: 'Clap Lamp', description: 'Mic turns the LED on', difficulty: 'Beginner', modules: ['mic', 'led'], op: '>', value: 600},
    {id: 'clap-servo', name: 'Clap Servo', description: 'Loud sound swings servo', difficulty: 'Medium', modules: ['mic', 'servo'], op: '>', value: 650},
    {id: 'clap-motor', name: 'Clap Motor', description: 'Mic runs the L293D', difficulty: 'Medium', modules: ['mic', 'l293d'], op: '>', value: 640, speed: 210},
    {id: 'gas-alert', name: 'MQ-2 Alert', description: 'LED when gas is high', difficulty: 'Beginner', modules: ['mq2', 'led'], op: '>', value: 700},
    {id: 'gas-servo', name: 'Gas Vent', description: 'Servo opens when gas is high', difficulty: 'Medium', modules: ['mq2', 'servo'], op: '>', value: 720},
    {id: 'gas-motor', name: 'Gas Fan', description: 'L293D fan when gas is high', difficulty: 'Medium', modules: ['mq2', 'l293d'], op: '>', value: 710, speed: 220},
    {id: 'pulse-led', name: 'Pulse LED', description: 'LED blinks with heartbeat', difficulty: 'Beginner', modules: ['pulse', 'led'], op: '>', value: 60, blink: true},
    {id: 'pulse-relay', name: 'Pulse Relay', description: 'Relay ticks with heartbeat', difficulty: 'Medium', modules: ['pulse', 'relay'], op: '>', value: 60},
    {id: 'near-relay', name: 'Near Relay', description: 'Relay when something is close', difficulty: 'Medium', modules: ['ultra', 'relay'], pattern: 'relay_burst', op: '<', value: 22},
    {id: 'near-motor', name: 'Near Motor', description: 'Motor when object is close', difficulty: 'Medium', modules: ['ultra', 'l293d'], op: '<', value: 30, speed: 180},
    {id: 'range-display', name: 'Range Display', description: 'Show distance on OLED', difficulty: 'Beginner', modules: ['ultra', 'oled'], pattern: 'display'},
    {id: 'rfid-relay', name: 'RFID Relay', description: 'Card clicks the relay', difficulty: 'Medium', modules: ['rfid', 'relay'], pattern: 'rfid_gate'},
    {id: 'rfid-led', name: 'RFID Lamp', description: 'Card lights the LED', difficulty: 'Medium', modules: ['rfid', 'led'], pattern: 'rfid_gate'},
    {id: 'rfid-gate-oled', name: 'RFID Gate', description: 'Card unlocks servo + OLED', difficulty: 'Medium', modules: ['rfid', 'servo', 'oled'], pattern: 'rfid_gate'},
    {id: 'ble-desk', name: 'BLE Desk', description: 'BLE plus OLED status', difficulty: 'Advanced', modules: ['ble', 'oled'], pattern: 'ble_beacon', bleText: 'Desk OK'},
    {id: 'ble-led', name: 'BLE Lamp', description: 'Advertise BLE and blink LED', difficulty: 'Medium', modules: ['ble', 'led'], pattern: 'ble_beacon'},
    {id: 'stepper-spin', name: 'Stepper Spin', description: 'Button spins 400 steps', difficulty: 'Medium', modules: ['btn', 'stepper'], pattern: 'stepper_demo', steps: 400, rpm: 15},
    {id: 'garden-meter', name: 'Garden Meter', description: 'Soil moisture % on OLED', difficulty: 'Beginner', modules: ['soil', 'oled'], pattern: 'display'},
    {id: 'gas-panel', name: 'Gas Panel', description: 'MQ-2 level on OLED', difficulty: 'Medium', modules: ['mq2', 'oled'], pattern: 'display'},
    {id: 'mic-meter', name: 'Mic Meter', description: 'Show loudness on OLED', difficulty: 'Beginner', modules: ['mic', 'oled'], pattern: 'display'}
];

const ADVANCED_SPECS = [
    {id: 'adv-garden', name: 'Garden Station', description: 'Soil % + DHT drive relay and OLED', difficulty: 'Advanced', modules: ['soil', 'dht', 'relay', 'oled', 'led'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, burstRelay: true},
    {id: 'adv-parking', name: 'Parking Pro', description: 'HC-SR04 + mic + OLED coach', difficulty: 'Advanced', modules: ['ultra', 'mic', 'led', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 25, blink: true, thenText: 'STOP', elseText: 'CLEAR'},
    {id: 'adv-climate', name: 'Climate Lab', description: 'DHT fan with OLED and LED', difficulty: 'Advanced', modules: ['dht', 'l293d', 'led', 'oled'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 30, speed: 220},
    {id: 'adv-gas-lab', name: 'Gas Lab', description: 'MQ-2 + OLED + relay safety', difficulty: 'Advanced', modules: ['mq2', 'oled', 'relay', 'led'], pattern: 'advanced_scene', primary: 'mq2', op: '>', value: 700, thenText: 'GAS!', elseText: 'OK'},
    {id: 'adv-console', name: 'Maker Console', description: 'Button + knob command center', difficulty: 'Advanced', modules: ['btn', 'pot', 'led', 'servo', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-access', name: 'Access Gate', description: 'RFID + button + servo gate', difficulty: 'Advanced', modules: ['rfid', 'btn', 'servo', 'led', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-pulse-lab', name: 'Pulse Lab', description: 'HW-605 + OLED + LED', difficulty: 'Advanced', modules: ['pulse', 'oled', 'led'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 60, blink: true},
    {id: 'adv-step-rig', name: 'Stepper Rig', description: 'Button + stepper + LED feedback', difficulty: 'Advanced', modules: ['btn', 'stepper', 'led'], pattern: 'stepper_demo'},
    {id: 'adv-sound-stage', name: 'Sound Stage', description: 'Mic + pot + LED + servo show', difficulty: 'Advanced', modules: ['mic', 'pot', 'led', 'servo', 'oled'], pattern: 'advanced_scene', primary: 'mic', op: '>', value: 620, blink: true, thenText: 'LOUD', elseText: 'QUIET'},
    {id: 'adv-soil-fan', name: 'Soil Fan Lab', description: 'Dry soil % runs L293D + OLED', difficulty: 'Advanced', modules: ['soil', 'l293d', 'led', 'oled'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, speed: 200},
    {id: 'adv-range-lock', name: 'Range Lock', description: 'HC-SR04 + RFID + servo door', difficulty: 'Advanced', modules: ['ultra', 'rfid', 'servo', 'led'], pattern: 'rfid_gate'},
    {id: 'adv-ble-garden', name: 'BLE Garden', description: 'Soil % relay with BLE beacon', difficulty: 'Advanced', modules: ['soil', 'relay', 'ble', 'oled'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, burstRelay: true},
    {id: 'adv-hot-gate', name: 'Hot Gate', description: 'Temp opens servo and lights LED', difficulty: 'Advanced', modules: ['dht', 'servo', 'led', 'oled'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 31, thenText: 'HOT', elseText: 'OK'},
    {id: 'adv-gas-step', name: 'Gas Stepper', description: 'MQ-2 + stepper vent demo', difficulty: 'Advanced', modules: ['mq2', 'stepper', 'led'], pattern: 'advanced_scene', primary: 'mq2', op: '>', value: 700, steps: 120},
    {id: 'adv-heart-stage', name: 'Heart Stage', description: 'Pulse + mic + OLED monitor', difficulty: 'Advanced', modules: ['pulse', 'mic', 'oled', 'led'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 60, blink: true},
    {id: 'adv-kit-tour', name: 'Kit Tour', description: 'Button tours LED, servo, OLED', difficulty: 'Advanced', modules: ['btn', 'led', 'servo', 'oled'], pattern: 'command_center', hold: 1.5}
];

const dedupeSpecs = specs => {
    const seen = {};
    return specs.filter(spec => {
        if (seen[spec.id]) {
            return false;
        }
        seen[spec.id] = true;
        return true;
    });
};

const PROJECT_SPECS = dedupeSpecs(FEATURED_SPECS.concat(EXTRA_SPECS).concat(expandPairs()));

const TEMPLATES = PROJECT_SPECS.concat(ADVANCED_SPECS).reduce((list, spec) => {
    try {
        const wiring = assignWiring(spec.modules);
        list.push(buildTemplate(
            {
                id: spec.id,
                name: spec.name,
                description: spec.description,
                difficulty: spec.difficulty || 'Beginner'
            },
            wiring,
            (m, act, blk) => programFor(spec, m, act, blk)
        ));
    } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[templates] skipped ${spec.id}:`, err && err.message ? err.message : err);
        }
    }
    return list;
}, []);

const templateById = id => TEMPLATES.find(t => t.id === id) || null;

const QUICK_START_IDS = [
    'led-blink',
    'button-lamp',
    'smart-garden',
    'temp-display',
    'parking-sensor',
    'smart-lock',
    'rfid-door',
    'ble-beacon'
];

const quickStartTemplates = () => QUICK_START_IDS.map(id => templateById(id)).filter(Boolean);

export {TEMPLATES, templateById, quickStartTemplates, PROJECT_SPECS, ADVANCED_SPECS};
