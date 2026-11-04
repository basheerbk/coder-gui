import {isOnOffSensor} from './condition';
import {uid} from './ids';
import {moduleById} from './modules';
import {pickPortForModule, portById} from './ports';
import {stripSilentReads} from './sensorReads';
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
    const cloudActive = moduleIds.indexOf('cloud') !== -1;
    return moduleIds.map(moduleId => {
        const mod = moduleById(moduleId);
        if (!mod) {
            throw new Error(`Unknown module: ${moduleId}`);
        }
        const portId = pickPortForModule(mod, used, cloudActive);
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
        program: stripSilentReads(buildProgram(byModule, actionBlock, createBlock))
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

const isBoolSensor = moduleId => isOnOffSensor(moduleById(moduleId));

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
    const ifElse = (params, children, elseChildren) => Object.assign(blk('if_then', {params}), {
        children,
        elseChildren: elseChildren || []
    });

    if (pattern === 'cloud_lamp') {
        return [
            ifElse({sensor: 'cloudSwitch1', op: 'is', value: 0},
                [act(m[onOff], 'set_on', {on: true})],
                [act(m[onOff], 'set_on', {on: false})]),
            blk('wait', {params: {seconds: 0.1}})
        ];
    }

    if (pattern === 'cloud_relays') {
        return [1, 2, 3, 4].map(ch => ifElse({sensor: `cloudSwitch${ch}`, op: 'is', value: 0},
            [act(m.relay4, 'relay_channel', {channel: ch, on: true})],
            [act(m.relay4, 'relay_channel', {channel: ch, on: false})]
        )).concat([blk('wait', {params: {seconds: 0.1}})]);
    }

    if (pattern === 'cloud_fan') {
        return [
            ifElse({sensor: 'cloudSlider1', op: '>', value: 60},
                [act(m.l293d, 'motor_speed', {speed: 230})],
                [ifElse({sensor: 'cloudSlider1', op: '>', value: 20},
                    [act(m.l293d, 'motor_speed', {speed: 150})],
                    [act(m.l293d, 'motor_stop')])]),
            blk('wait', {params: {seconds: 0.1}})
        ];
    }

    if (pattern === 'cloud_doorbell') {
        const alert = [
            act(m.cloud, 'cloud_alert', {text: spec.alertText || 'Someone is at the door!'}),
            blk('wait', {params: {seconds: spec.cooldown || 2}})
        ];
        return [
            act(m[sensor], readAction(sensor)),
            spec.invert ?
                ifElse({sensor: sensorVar(sensor), op: 'is', value: 0}, [], alert) :
                ifElse({sensor: sensorVar(sensor), op: 'is', value: 0}, alert),
            blk('wait', {params: {seconds: 0.05}})
        ];
    }

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
        thenKids.push(blk('wait', {params: {seconds: spec.hold || 0.3}}));
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
        const burstOut = m[spec.burstOut || 'relay'];
        return [
            act(m[sensor], readAction(sensor)),
            Object.assign(blk('if_then', {
                params: {sensor: sensorVar(sensor), op, value: threshold}
            }), {
                children: [
                    act(burstOut, 'set_on', {on: true}),
                    blk('wait', {params: {seconds: spec.burst != null ? spec.burst : 2}}),
                    act(burstOut, 'set_on', {on: false})
                ],
                elseChildren: [act(burstOut, 'set_on', {on: false})]
            }),
            blk('wait', {params: {seconds: spec.rest || 1}})
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
        const onCard = [];
        if (oled) {
            onCard.push(act(m.oled, 'show_text', {text: spec.thenText || 'Card OK'}));
        } else {
            onCard.push(blk('serial_print', {params: {text: 'Card OK'}}));
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
            unlock.push(blk('wait', {params: {seconds: spec.hold || 0.4}}));
            unlock.push(act(m[onOff], 'set_on', {on: false}));
        }
        if (m.ultra && unlock.length) {
            onCard.push(Object.assign(blk('if_then', {
                params: {sensor: 'distance', op: spec.op || '<', value: threshold}
            }), {
                children: unlock,
                elseChildren: []
            }));
        } else {
            unlock.forEach(b => onCard.push(b));
        }
        return [
            Object.assign(blk('if_then', {params: {sensor: 'rfidUid', op: 'is', value: 0}}), {
                children: onCard,
                elseChildren: []
            }),
            blk('wait', {params: {seconds: 0.3}})
        ];
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
                // invert: act when the sensor stops seeing its thing (a door alarm fires when the magnet leaves)
                children: spec.invert ? elseKids : thenKids,
                elseChildren: spec.invert ? thenKids : elseKids
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
 *          dht, soil, servo, l293d, ultra (HC-SR04), rfid, pot, ir, pir, reed, ldr, flame,
 *          water, buzzer, pump, solenoid
 */
const SENSOR_GATES = [
    {id: 'pot', label: 'Knob', noun: 'knob number', when: 'you turn the knob up', op: '>', value: 2000,
        difficulty: 'Beginner'},
    {id: 'soil', label: 'Soil', noun: 'soil wetness', when: 'the soil gets dry', op: '<', value: 40,
        difficulty: 'Beginner'},
    {id: 'mq2', label: 'Gas', noun: 'gas level', when: 'it smells gas or smoke', op: '>', value: 700,
        difficulty: 'Beginner'},
    {id: 'mic', label: 'Sound', noun: 'loudness', when: 'it gets loud', op: '>', value: 600, difficulty: 'Beginner'},
    {id: 'pulse', label: 'Heartbeat', noun: 'heartbeat', when: 'it feels a heartbeat', op: '>', value: 60,
        difficulty: 'Medium'},
    {id: 'ultra', label: 'Distance', noun: 'distance', when: 'something comes close', op: '<', value: 25,
        difficulty: 'Medium'},
    {id: 'dht', label: 'Temp', noun: 'temperature', when: 'it gets hot', op: '>', value: 30, difficulty: 'Medium'}
];

const OUT_ACTIONS = [
    {id: 'led', label: 'Light', verb: 'The LED lights up', blink: true},
    {id: 'relay', label: 'Relay', verb: 'The relay clicks on', burst: true},
    {id: 'servo', label: 'Servo', verb: 'The servo arm moves'},
    {id: 'l293d', label: 'Motor', verb: 'The motor spins', speed: 200},
    {id: 'oled', label: 'Screen', display: true}
];

const FEATURED_SPECS = [
    {id: 'led-blink', name: 'LED Blink', description: 'Make the LED blink on and off', difficulty: 'Beginner', modules: ['led'], pattern: 'blink'},
    {id: 'button-lamp', name: 'Button Lamp', description: 'Press to light the LED', difficulty: 'Beginner', modules: ['btn', 'led'], pattern: 'button_burst'},
    {id: 'smart-lock', name: 'Smart Lock', description: 'Press the button to open the lock', difficulty: 'Beginner', modules: ['btn', 'servo', 'led'], pattern: 'button_burst'},
    {id: 'relay-switch', name: 'Relay Switch', description: 'Press the button to click the relay on', difficulty: 'Beginner', modules: ['btn', 'relay'], pattern: 'button_burst'},
    {id: 'md-relay-ch1', name: 'Relay Switch 1', description: 'Press the button to turn on switch 1 of the 4-switch relay', difficulty: 'Beginner', modules: ['btn', 'relay4'], pattern: 'button_burst', channel: 1},
    {id: 'md-relay-sweep', name: 'Relay Blinker', description: 'Switch 1 of the 4-switch relay clicks on and off', difficulty: 'Beginner', modules: ['relay4'], pattern: 'relay4_seq', channel: 1},
    {id: 'smart-garden', name: 'Smart Garden', description: 'Waters the plant when the soil gets dry', difficulty: 'Beginner', modules: ['soil', 'relay'], pattern: 'relay_burst', op: '<', value: 40},
    {id: 'temp-display', name: 'Temp Display', description: 'Show the temperature on a screen', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_temp'},
    {id: 'parking-sensor', name: 'Parking Sensor', description: 'The LED lights up when something is close', difficulty: 'Medium', modules: ['ultra', 'led'], op: '<', value: 20, blink: true},
    {id: 'speed-fan', name: 'Speed Fan', description: 'Turn the knob to change the motor speed', difficulty: 'Beginner', modules: ['pot', 'l293d'], pattern: 'pot_motor'},
    {id: 'knob-servo', name: 'Knob Servo', description: 'Turn the knob to move the servo arm', difficulty: 'Beginner', modules: ['pot', 'servo'], pattern: 'pot_servo'},
    {id: 'humid-display', name: 'Humidity Display', description: 'Show how damp the air is on a screen', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_humid'},
    {id: 'heart-monitor', name: 'Heart Monitor', description: 'Show your heartbeat on a screen', difficulty: 'Medium', modules: ['pulse', 'oled'], pattern: 'display'},
    {id: 'smart-dustbin', name: 'Smart Dustbin', description: 'The lid opens when your hand comes close', difficulty: 'Medium', modules: ['ultra', 'servo'], op: '<', value: 25},
    {id: 'stepper-jog', name: 'Stepper Jog', description: 'Press the button to turn the stepper motor', difficulty: 'Medium', modules: ['btn', 'stepper'], pattern: 'stepper_demo'},
    {id: 'rfid-scan', name: 'Card Scanner', description: 'Tap a card and see it on the screen', difficulty: 'Medium', modules: ['rfid', 'oled'], pattern: 'rfid_gate'},
    {id: 'rfid-door', name: 'Card Door', description: 'Tap a card to open the lock', difficulty: 'Medium', modules: ['rfid', 'servo', 'led'], pattern: 'rfid_gate'},
    {id: 'ble-beacon', name: 'Bluetooth Beacon', description: 'Send a hello to your phone over Bluetooth', difficulty: 'Medium', modules: ['ble'], pattern: 'ble_beacon'}
];

/** True when a hand-written project already covers this sensor + output pair or name. */
const coveredByHandWritten = (id, name, sensorId, outId) => FEATURED_SPECS.concat(EXTRA_SPECS).some(s => (
    s.id === id ||
    s.name === name ||
    (s.modules.length === 2 && s.modules.indexOf(sensorId) !== -1 && s.modules.indexOf(outId) !== -1)
));

const expandPairs = () => {
    const list = [];
    SENSOR_GATES.forEach(sensor => {
        OUT_ACTIONS.forEach(out => {
            if (sensor.id === 'dht' && out.display) {
                return;
            }
            const id = `p-${sensor.id}-${out.id}`;
            const name = out.display ? `${sensor.label} Meter` : `${sensor.label} ${out.label}`;
            if (coveredByHandWritten(id, name, sensor.id, out.id)) {
                return;
            }
            if (out.display) {
                list.push({
                    id,
                    name,
                    description: `Show the ${sensor.noun} on a screen`,
                    difficulty: sensor.difficulty,
                    modules: [sensor.id, 'oled'],
                    pattern: 'display'
                });
                return;
            }
            if (out.burst && out.id === 'relay') {
                list.push({
                    id,
                    name,
                    description: `${out.verb} when ${sensor.when}`,
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
                name,
                description: `${out.verb} when ${sensor.when}`,
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
    {id: 'btn-relay-led', name: 'Button Power', description: 'Press to click the relay and light the LED', difficulty: 'Beginner', modules: ['btn', 'relay', 'led'], pattern: 'button_burst'},
    {id: 'btn-servo', name: 'Button Servo', description: 'Press to swing the servo', difficulty: 'Beginner', modules: ['btn', 'servo'], pattern: 'button_burst'},
    {id: 'btn-motor', name: 'Button Motor', description: 'Press to spin the motor', difficulty: 'Beginner', modules: ['btn', 'l293d'], pattern: 'button_burst'},
    {id: 'btn-stepper-led', name: 'Stepper Click', description: 'Press to turn the stepper motor, with a light', difficulty: 'Medium', modules: ['btn', 'stepper', 'led'], pattern: 'stepper_demo'},
    {id: 'pot-led', name: 'Knob Lamp', description: 'Turn the knob up to light the LED', difficulty: 'Beginner', modules: ['pot', 'led'], op: '>', value: 2000},
    {id: 'pot-relay', name: 'Knob Relay', description: 'Turn the knob up to click the relay', difficulty: 'Beginner', modules: ['pot', 'relay'], op: '>', value: 2200},
    {id: 'pot-oled', name: 'Knob Meter', description: 'Show the knob number on a screen', difficulty: 'Beginner', modules: ['pot', 'oled'], pattern: 'display'},
    {id: 'hot-fan', name: 'Hot Fan', description: 'The fan spins when it gets hot', difficulty: 'Medium', modules: ['dht', 'l293d'], op: '>', value: 30, speed: 200},
    {id: 'hot-relay', name: 'Hot Relay', description: 'The relay clicks on when the room is hot', difficulty: 'Medium', modules: ['dht', 'relay'], pattern: 'relay_burst', op: '>', value: 32},
    {id: 'cool-led', name: 'Cool LED', description: 'The LED lights up when it gets cold', difficulty: 'Medium', modules: ['dht', 'led'], op: '<', value: 20},
    {id: 'soil-led', name: 'Dry Soil Lamp', description: 'The LED lights up when the plant needs water', difficulty: 'Beginner', modules: ['soil', 'led'], op: '<', value: 40},
    {id: 'soil-servo', name: 'Soil Gate', description: 'The servo moves when the soil is dry', difficulty: 'Medium', modules: ['soil', 'servo'], op: '<', value: 40},
    {id: 'clap-lamp', name: 'Clap Lamp', description: 'Mic turns the LED on', difficulty: 'Beginner', modules: ['mic', 'led'], op: '>', value: 600},
    {id: 'clap-servo', name: 'Clap Servo', description: 'Loud sound swings servo', difficulty: 'Medium', modules: ['mic', 'servo'], op: '>', value: 650},
    {id: 'clap-motor', name: 'Clap Motor', description: 'A loud sound spins the motor', difficulty: 'Medium', modules: ['mic', 'l293d'], op: '>', value: 640, speed: 210},
    {id: 'gas-alert', name: 'Gas Alarm', description: 'The LED lights up when it smells gas or smoke', difficulty: 'Beginner', modules: ['mq2', 'led'], op: '>', value: 700},
    {id: 'gas-servo', name: 'Gas Vent', description: 'Opens a vent when it smells gas', difficulty: 'Medium', modules: ['mq2', 'servo'], op: '>', value: 720},
    {id: 'gas-motor', name: 'Gas Fan', description: 'The fan spins when it smells gas', difficulty: 'Medium', modules: ['mq2', 'l293d'], op: '>', value: 710, speed: 220},
    {id: 'pulse-led', name: 'Pulse LED', description: 'LED blinks with heartbeat', difficulty: 'Beginner', modules: ['pulse', 'led'], op: '>', value: 60, blink: true},
    {id: 'pulse-relay', name: 'Pulse Relay', description: 'Relay ticks with heartbeat', difficulty: 'Medium', modules: ['pulse', 'relay'], op: '>', value: 60},
    {id: 'near-relay', name: 'Near Relay', description: 'Relay when something is close', difficulty: 'Medium', modules: ['ultra', 'relay'], pattern: 'relay_burst', op: '<', value: 22},
    {id: 'near-motor', name: 'Near Motor', description: 'Motor when object is close', difficulty: 'Medium', modules: ['ultra', 'l293d'], op: '<', value: 30, speed: 180},
    {id: 'range-display', name: 'Distance Display', description: 'Show how far away things are on a screen', difficulty: 'Beginner', modules: ['ultra', 'oled'], pattern: 'display'},
    {id: 'rfid-relay', name: 'Card Relay', description: 'Tap a card to click the relay', difficulty: 'Medium', modules: ['rfid', 'relay'], pattern: 'rfid_gate'},
    {id: 'rfid-led', name: 'Card Lamp', description: 'Tap a card to light the LED', difficulty: 'Medium', modules: ['rfid', 'led'], pattern: 'rfid_gate'},
    {id: 'rfid-gate-oled', name: 'Card Gate', description: 'Tap a card to open the gate, with a screen', difficulty: 'Medium', modules: ['rfid', 'servo', 'oled'], pattern: 'rfid_gate'},
    {id: 'ble-desk', name: 'Bluetooth Desk', description: 'Bluetooth plus a status screen', difficulty: 'Advanced', modules: ['ble', 'oled'], pattern: 'ble_beacon', bleText: 'Desk OK'},
    {id: 'ble-led', name: 'Bluetooth Lamp', description: 'Bluetooth hello and a blinking LED', difficulty: 'Medium', modules: ['ble', 'led'], pattern: 'ble_beacon'},
    {id: 'stepper-spin', name: 'Stepper Spin', description: 'Press to spin the stepper a long way', difficulty: 'Medium', modules: ['btn', 'stepper'], pattern: 'stepper_demo', steps: 400, rpm: 15},
    {id: 'garden-meter', name: 'Garden Meter', description: 'Show how wet the soil is on a screen', difficulty: 'Beginner', modules: ['soil', 'oled'], pattern: 'display'},
    {id: 'gas-panel', name: 'Gas Panel', description: 'Show the gas level on a screen', difficulty: 'Medium', modules: ['mq2', 'oled'], pattern: 'display'},
    {id: 'mic-meter', name: 'Mic Meter', description: 'Show how loud it is on a screen', difficulty: 'Beginner', modules: ['mic', 'oled'], pattern: 'display'}
];

/** Alarms and helpers for the on/off sensors, buzzer, pump and door lock. */
const SENSOR_KIT_SPECS = [
    {id: 'doorbell', name: 'Doorbell', description: 'Press the button to ring the buzzer', difficulty: 'Beginner', modules: ['btn', 'buzzer'], pattern: 'button_burst'},
    {id: 'motion-alarm', name: 'Intruder Alarm', description: 'The buzzer sounds when someone walks past', difficulty: 'Beginner', modules: ['pir', 'buzzer']},
    {id: 'motion-lamp', name: 'Motion Lamp', description: 'The LED turns on when something moves', difficulty: 'Beginner', modules: ['pir', 'led']},
    {id: 'hand-detector', name: 'Hand Detector', description: 'The LED lights up when your hand is in front of the sensor', difficulty: 'Beginner', modules: ['ir', 'led']},
    {id: 'hand-gate', name: 'Wave Gate', description: 'Wave your hand in front of the sensor to open the gate', difficulty: 'Medium', modules: ['ir', 'servo']},
    {id: 'door-alarm', name: 'Door Alarm', description: 'The buzzer sounds when the door opens and the magnet moves away', difficulty: 'Beginner', modules: ['reed', 'buzzer'], invert: true},
    {id: 'night-light', name: 'Night Light', description: 'The LED turns on when it gets dark', difficulty: 'Beginner', modules: ['ldr', 'led']},
    {id: 'fire-alarm', name: 'Fire Alarm', description: 'The buzzer sounds when it sees a flame', difficulty: 'Beginner', modules: ['flame', 'buzzer']},
    {id: 'flood-alarm', name: 'Flood Alarm', description: 'The buzzer sounds when the water gets high', difficulty: 'Beginner', modules: ['water', 'buzzer'], op: '>', value: 1000},
    {id: 'water-meter', name: 'Water Tank Meter', description: 'Show how high the water is on a screen', difficulty: 'Beginner', modules: ['water', 'oled'], pattern: 'display'},
    {id: 'plant-waterer', name: 'Plant Waterer', description: 'The pump waters the plant for a moment when the soil gets dry', difficulty: 'Medium', modules: ['soil', 'pump'], pattern: 'relay_burst', burstOut: 'pump', op: '<', value: 40, burst: 2, rest: 5},
    {id: 'card-lock', name: 'Card Door Lock', description: 'Tap a card to open the door lock for a few seconds', difficulty: 'Medium', modules: ['rfid', 'solenoid'], pattern: 'rfid_gate', hold: 3},
    {id: 'button-lock', name: 'Button Lock', description: 'Press the button to open the door lock', difficulty: 'Beginner', modules: ['btn', 'solenoid'], pattern: 'button_burst', hold: 3}
];

const ADVANCED_SPECS = [
    {id: 'adv-garden', name: 'Garden Station', description: 'Waters dry soil and shows the temperature on a screen', difficulty: 'Advanced', modules: ['soil', 'dht', 'relay', 'oled', 'led'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, burstRelay: true},
    {id: 'adv-parking', name: 'Parking Pro', description: 'The screen says STOP when you get too close', difficulty: 'Advanced', modules: ['ultra', 'mic', 'led', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 25, blink: true, thenText: 'STOP', elseText: 'CLEAR'},
    {id: 'adv-climate', name: 'Climate Lab', description: 'Fan, light and screen react to the temperature', difficulty: 'Advanced', modules: ['dht', 'l293d', 'led', 'oled'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 30, speed: 220},
    {id: 'adv-gas-lab', name: 'Gas Lab', description: 'Gas alarm with a screen and a safety switch', difficulty: 'Advanced', modules: ['mq2', 'oled', 'relay', 'led'], pattern: 'advanced_scene', primary: 'mq2', op: '>', value: 700, thenText: 'GAS!', elseText: 'OK'},
    {id: 'adv-console', name: 'Maker Console', description: 'Button and knob control a light, servo and screen', difficulty: 'Advanced', modules: ['btn', 'pot', 'led', 'servo', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-access', name: 'Access Gate', description: 'The button opens the gate; tapped cards show their ID in Board messages', difficulty: 'Advanced', modules: ['rfid', 'btn', 'servo', 'led', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-pulse-lab', name: 'Pulse Lab', description: 'Your heartbeat on a screen with a blinking LED', difficulty: 'Advanced', modules: ['pulse', 'oled', 'led'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 60, blink: true},
    {id: 'adv-step-rig', name: 'Stepper Rig', description: 'Press to turn the stepper, with a light', difficulty: 'Advanced', modules: ['btn', 'stepper', 'led'], pattern: 'stepper_demo'},
    {id: 'adv-sound-stage', name: 'Sound Stage', description: 'Lights and a servo react to loud sounds', difficulty: 'Advanced', modules: ['mic', 'pot', 'led', 'servo', 'oled'], pattern: 'advanced_scene', primary: 'mic', op: '>', value: 620, blink: true, thenText: 'LOUD', elseText: 'QUIET'},
    {id: 'adv-soil-fan', name: 'Soil Fan Lab', description: 'A fan runs when the soil is dry, with a screen', difficulty: 'Advanced', modules: ['soil', 'l293d', 'led', 'oled'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, speed: 200},
    {id: 'adv-range-lock', name: 'Range Lock', description: 'Come close and tap a card to open the door', difficulty: 'Advanced', modules: ['ultra', 'rfid', 'servo', 'led'], pattern: 'rfid_gate'},
    {id: 'adv-ble-garden', name: 'Bluetooth Garden', description: 'Waters dry soil and tells your phone over Bluetooth', difficulty: 'Advanced', modules: ['soil', 'relay', 'ble', 'oled'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 40, burstRelay: true},
    {id: 'adv-hot-gate', name: 'Hot Gate', description: 'Opens a vent and lights the LED when it is hot', difficulty: 'Advanced', modules: ['dht', 'servo', 'led', 'oled'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 31, thenText: 'HOT', elseText: 'OK'},
    {id: 'adv-gas-step', name: 'Gas Stepper', description: 'A stepper motor opens a vent when it smells gas', difficulty: 'Advanced', modules: ['mq2', 'stepper', 'led'], pattern: 'advanced_scene', primary: 'mq2', op: '>', value: 700, steps: 120},
    {id: 'adv-heart-stage', name: 'Heart Stage', description: 'Heartbeat and loudness on a screen', difficulty: 'Advanced', modules: ['pulse', 'mic', 'oled', 'led'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 60, blink: true},
    {id: 'adv-kit-tour', name: 'Kit Tour', description: 'One button shows off the LED, servo and screen', difficulty: 'Advanced', modules: ['btn', 'led', 'servo', 'oled'], pattern: 'command_center', hold: 1.5}
];

/** WiFi projects: A1–A4 are off while Cloud is on, so every part here uses D13, D5, MD or I2C. */
const CLOUD_SPECS = [
    {id: 'cloud-lamp', name: 'Phone Lamp', description: 'Dashboard switch turns the LED on', difficulty: 'Beginner', modules: ['cloud', 'led'], pattern: 'cloud_lamp'},
    {id: 'cloud-doorbell', name: 'Phone Doorbell', description: 'Button sends an alert to your phone', difficulty: 'Beginner', modules: ['cloud', 'btn'], pattern: 'cloud_doorbell'},
    {id: 'cloud-relays', name: 'Phone Relays', description: 'Four phone switches control the 4-switch relay', difficulty: 'Medium', modules: ['cloud', 'relay4'], pattern: 'cloud_relays'},
    {id: 'cloud-parking', name: 'Cloud Parking Sensor', description: 'Distance on your phone, LED when close', difficulty: 'Medium', modules: ['cloud', 'ultra', 'led'], op: '<', value: 20, blink: true},
    {id: 'cloud-heart', name: 'Heartbeat Monitor', description: 'Your heartbeat on a screen and on your phone', difficulty: 'Medium', modules: ['cloud', 'pulse', 'oled'], pattern: 'display'},
    {id: 'cloud-fan', name: 'Smart Fan', description: 'Dashboard slider sets the fan speed', difficulty: 'Medium', modules: ['cloud', 'l293d'], pattern: 'cloud_fan'},
    {id: 'cloud-motion', name: 'Motion Alert', description: 'Your phone gets an alert when something moves', difficulty: 'Beginner', modules: ['cloud', 'pir'], pattern: 'cloud_doorbell', alertText: 'Something moved!', cooldown: 10},
    {id: 'cloud-door', name: 'Door Watcher', description: 'Your phone gets an alert when the door opens', difficulty: 'Beginner', modules: ['cloud', 'reed'], pattern: 'cloud_doorbell', invert: true, alertText: 'The door opened!', cooldown: 10},
    {id: 'cloud-pump', name: 'Phone Plant Waterer', description: 'A dashboard switch runs the water pump', difficulty: 'Beginner', modules: ['cloud', 'pump'], pattern: 'cloud_lamp'}
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

const PROJECT_SPECS = dedupeSpecs(FEATURED_SPECS.concat(SENSOR_KIT_SPECS).concat(EXTRA_SPECS).concat(expandPairs()));

const TEMPLATES = PROJECT_SPECS.concat(ADVANCED_SPECS).concat(CLOUD_SPECS).reduce((list, spec) => {
    try {
        const wiring = assignWiring(spec.modules);
        list.push(buildTemplate(
            {
                id: spec.id,
                name: spec.name,
                description: spec.description,
                difficulty: spec.difficulty || 'Beginner',
                cloud: spec.modules.indexOf('cloud') !== -1
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

export {TEMPLATES, templateById, quickStartTemplates, PROJECT_SPECS, ADVANCED_SPECS, CLOUD_SPECS};
