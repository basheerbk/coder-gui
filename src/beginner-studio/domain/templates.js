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
        used[portId] = true;
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

const isBoolSensor = moduleId => moduleId === 'btn' || moduleId === 'pir';

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
    const buzz = outs.find(id => id === 'buzz');
    const oled = outs.find(id => id === 'oled');
    const servo = outs.find(id => id === 'servo');
    const motor = outs.find(id => id === 'dc');
    const sensors = modules.filter(id => {
        const mod = moduleById(id);
        return mod && mod.dir === 'in';
    });
    const primary = spec.primary && modules.indexOf(spec.primary) !== -1
        ? spec.primary
        : (sensor || null);

    const op = spec.op || '<';
    const threshold = spec.value != null ? spec.value : 500;
    const waitSec = spec.wait != null ? spec.wait : 0.2;

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
            act(m.dht, 'read_temp'),
            oled ? act(m.oled, 'show_number', {varName: 'temperature'}) : blk('serial_var', {params: {varName: 'temperature'}}),
            blk('wait', {params: {seconds: 1}})
        ];
    }

    if (pattern === 'display_humid') {
        return [
            act(m.dht, 'read_humidity'),
            oled ? act(m.oled, 'show_number', {varName: 'humidity'}) : blk('serial_var', {params: {varName: 'humidity'}}),
            blk('wait', {params: {seconds: 1}})
        ];
    }

    if (pattern === 'pot_motor') {
        return [
            act(m.pot, 'read_value'),
            act(m.dc, 'motor_speed', {speed: spec.speed != null ? spec.speed : 180}),
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
        if (buzz) {
            thenKids.push(act(m.buzz, 'play_tone', {freq: spec.freq || 800}));
        }
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: 90}));
        }
        if (onOff) {
            thenKids.push(act(m[onOff], 'set_on', {on: true}));
        }
        thenKids.push(blk('wait', {params: {seconds: 0.3}}));
        if (buzz) {
            thenKids.push(act(m.buzz, 'stop_tone'));
        }
        if (servo) {
            thenKids.push(blk('wait', {params: {seconds: 1.5}}));
            thenKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (onOff) {
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

    if (pattern === 'pump_burst') {
        return [
            act(m[sensor], readAction(sensor)),
            Object.assign(blk('if_then', {
                params: {
                    sensor: sensorVar(sensor),
                    op,
                    value: threshold
                }
            }), {
                children: [
                    act(m.pump, 'set_on', {on: true}),
                    blk('wait', {params: {seconds: spec.burst != null ? spec.burst : 2}}),
                    act(m.pump, 'set_on', {on: false})
                ],
                elseChildren: [act(m.pump, 'set_on', {on: false})]
            }),
            blk('wait', {params: {seconds: 1}})
        ];
    }

    const pushOutputs = (thenKids, elseKids, opts) => {
        const useBlink = opts && opts.blink;
        onOffIds.forEach(id => {
            if (id === 'pump' && opts && opts.skipPump) {
                return;
            }
            thenKids.push(act(m[id], id === 'led' && useBlink ? 'blink' : 'set_on',
                id === 'led' && useBlink ? {ms: 200} : {on: true}));
            elseKids.push(act(m[id], 'set_on', {on: false}));
        });
        if (buzz) {
            thenKids.push(act(m.buzz, 'play_tone', {freq: spec.freq || 1000}));
            elseKids.push(act(m.buzz, 'stop_tone'));
        }
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: spec.angle != null ? spec.angle : 90}));
            elseKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (motor) {
            thenKids.push(act(m.dc, 'motor_speed', {speed: spec.speed != null ? spec.speed : 200}));
            elseKids.push(act(m.dc, 'motor_stop'));
        }
        if (oled && !(opts && opts.skipOledMsg)) {
            thenKids.push(act(m.oled, 'show_text', {text: spec.thenText || 'ALERT'}));
            elseKids.push(act(m.oled, 'show_text', {text: spec.elseText || 'OK'}));
        }
    };

    // Advanced: read every sensor, show primary on OLED, gate on primary with all outputs
    if (pattern === 'advanced_scene') {
        const gate = primary || sensor;
        const lines = sensors.map(id => act(m[id], readAction(id)));
        if (oled && gate) {
            lines.push(act(m.oled, 'show_number', {varName: sensorVar(gate)}));
        }
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {
            blink: spec.blink,
            skipOledMsg: true,
            skipPump: Boolean(spec.burstPump)
        });
        if (spec.burstPump && m.pump) {
            thenKids.push(act(m.pump, 'set_on', {on: true}));
            thenKids.push(blk('wait', {params: {seconds: spec.burst || 1.5}}));
            thenKids.push(act(m.pump, 'set_on', {on: false}));
        }
        if (!thenKids.length) {
            thenKids.push(blk('serial_print', {params: {text: 'triggered'}}));
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
        // Button arms a full stack of actuators
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {blink: true});
        thenKids.push(blk('wait', {params: {seconds: spec.hold != null ? spec.hold : 2}}));
        onOffIds.forEach(id => thenKids.push(act(m[id], 'set_on', {on: false})));
        if (buzz) {
            thenKids.push(act(m.buzz, 'stop_tone'));
        }
        if (servo) {
            thenKids.push(act(m.servo, 'set_angle', {angle: 0}));
        }
        if (motor) {
            thenKids.push(act(m.dc, 'motor_stop'));
        }
        return [
            act(m.btn, 'is_pressed'),
            Object.assign(blk('if_then', {params: {sensor: 'buttonState', op: 'is', value: 0}}), {
                children: thenKids,
                elseChildren: elseKids
            }),
            blk('wait', {params: {seconds: 0.05}})
        ];
    }

    // Default: sensor gate → turn outputs on/off (and optional tone / servo / motor)
    if (sensor) {
        const thenKids = [];
        const elseKids = [];
        pushOutputs(thenKids, elseKids, {blink: spec.blink});
        if (!thenKids.length) {
            thenKids.push(blk('serial_print', {params: {text: 'triggered'}}));
        }

        const ifParams = isBoolSensor(sensor)
            ? {sensor: sensorVar(sensor), op: 'is', value: 0}
            : {sensor: sensorVar(sensor), op, value: threshold};

        return [
            act(m[sensor], readAction(sensor)),
            Object.assign(blk('if_then', {params: ifParams}), {
                children: thenKids,
                elseChildren: elseKids
            }),
            blk('wait', {params: {seconds: waitSec}})
        ];
    }

    // Outputs only
    if (buzz && onOff) {
        return [
            act(m[onOff], 'set_on', {on: true}),
            act(m.buzz, 'play_tone', {freq: 900}),
            blk('wait', {params: {seconds: 0.5}}),
            act(m.buzz, 'stop_tone'),
            act(m[onOff], 'set_on', {on: false}),
            blk('wait', {params: {seconds: 0.5}})
        ];
    }
    if (outs[0]) {
        const outId = outs[0];
        const firstType = (moduleById(outId).actions[0] || {}).type || 'set_on';
        return [
            act(m[outId], firstType, firstType === 'set_on' ? {on: true} : undefined),
            blk('wait', {params: {seconds: 1}})
        ];
    }
    return [blk('wait', {params: {seconds: 1}})];
};

/**
 * 100 beginner projects — valid Maker ESP32 port mixes (≤5 digital, ≤3 analog).
 * Patterns reuse the same block builders so every project loads into Code.
 */
const PROJECT_SPECS = [
    // —— Keep classic quick-starts (stable ids) ——
    {id: 'night-light', name: 'Night Light', description: 'LED on when it gets dark', difficulty: 'Beginner', modules: ['ldr', 'led'], op: '<', value: 500},
    {id: 'smart-garden', name: 'Smart Garden', description: 'Water plants when soil is dry', difficulty: 'Beginner', modules: ['soil', 'pump'], pattern: 'pump_burst', op: '<', value: 400},
    {id: 'security-alarm', name: 'Security Alarm', description: 'Buzz and flash on motion', difficulty: 'Beginner', modules: ['pir', 'buzz', 'led'], blink: true, freq: 1200},
    {id: 'temp-display', name: 'Temp Display', description: 'Show temperature on OLED', difficulty: 'Medium', modules: ['dht', 'oled'], pattern: 'display_temp'},
    {id: 'fire-alarm', name: 'Fire Alarm', description: 'Alert when flame is detected', difficulty: 'Beginner', modules: ['flame', 'buzz', 'led'], op: '<', value: 300, freq: 1500},
    {id: 'parking-sensor', name: 'Parking Sensor', description: 'Beep when something is close', difficulty: 'Medium', modules: ['ultra', 'buzz', 'led'], op: '<', value: 20, blink: true, freq: 900},
    {id: 'clap-switch', name: 'Clap Switch', description: 'Toggle a relay when it is loud', difficulty: 'Medium', modules: ['sound', 'relay'], op: '>', value: 600},
    {id: 'speed-fan', name: 'Speed Fan', description: 'Control motor speed with a knob', difficulty: 'Beginner', modules: ['pot', 'dc'], pattern: 'pot_motor'},
    {id: 'smart-dustbin', name: 'Smart Dustbin', description: 'Open the lid when you approach', difficulty: 'Medium', modules: ['ultra', 'servo'], op: '<', value: 25},
    {id: 'gas-alert', name: 'Gas Alert', description: 'Show gas level and buzz if high', difficulty: 'Medium', modules: ['gas', 'oled', 'buzz'], op: '>', value: 700, freq: 1100},
    {id: 'heart-monitor', name: 'Heart Monitor', description: 'Display heart rate and pulse LED', difficulty: 'Medium', modules: ['pulse', 'oled', 'led'], op: '>', value: 60, blink: true},
    {id: 'smart-lock', name: 'Smart Lock', description: 'Press button to unlock with a servo', difficulty: 'Beginner', modules: ['btn', 'servo', 'buzz'], pattern: 'button_burst'},

    // —— Light & vision ——
    {id: 'p013-dawn-lamp', name: 'Dawn Lamp', description: 'Soft LED when morning light rises', difficulty: 'Beginner', modules: ['ldr', 'rgb'], op: '>', value: 600},
    {id: 'p014-closet-light', name: 'Closet Light', description: 'Motion turns on a closet LED', difficulty: 'Beginner', modules: ['pir', 'led']},
    {id: 'p015-dark-buzzer', name: 'Dark Buzzer', description: 'Buzz in the dark', difficulty: 'Beginner', modules: ['ldr', 'buzz'], op: '<', value: 400, freq: 700},
    {id: 'p016-light-meter', name: 'Light Meter', description: 'Show brightness on screen', difficulty: 'Beginner', modules: ['ldr', 'oled'], pattern: 'display'},
    {id: 'p017-sun-fan', name: 'Sun Fan', description: 'Spin a fan when it is bright', difficulty: 'Medium', modules: ['ldr', 'dc'], op: '>', value: 700, speed: 220},
    {id: 'p018-shadow-alarm', name: 'Shadow Alarm', description: 'Relay clicks when light drops', difficulty: 'Beginner', modules: ['ldr', 'relay'], op: '<', value: 350},
    {id: 'p019-rgb-night', name: 'RGB Night Glow', description: 'RGB on at night', difficulty: 'Beginner', modules: ['ldr', 'rgb'], op: '<', value: 450},
    {id: 'p020-reading-lamp', name: 'Reading Lamp', description: 'Button toggles desk LED', difficulty: 'Beginner', modules: ['btn', 'led'], pattern: 'button_burst'},

    // —— Garden & water ——
    {id: 'p021-dry-soil-led', name: 'Dry Soil LED', description: 'LED warns when soil is dry', difficulty: 'Beginner', modules: ['soil', 'led'], op: '<', value: 380},
    {id: 'p022-soil-buzz', name: 'Soil Buzzer', description: 'Buzz when plants need water', difficulty: 'Beginner', modules: ['soil', 'buzz'], op: '<', value: 420, freq: 650},
    {id: 'p023-soil-display', name: 'Soil Display', description: 'Show soil moisture value', difficulty: 'Beginner', modules: ['soil', 'oled'], pattern: 'display'},
    {id: 'p024-auto-water', name: 'Auto Water', description: 'Short pump burst when dry', difficulty: 'Medium', modules: ['soil', 'pump'], pattern: 'pump_burst', op: '<', value: 360, burst: 1.5},
    {id: 'p025-rain-relay', name: 'Garden Relay', description: 'Relay for garden light when dry', difficulty: 'Medium', modules: ['soil', 'relay'], op: '<', value: 400},
    {id: 'p026-humid-pump', name: 'Warm Mist', description: 'Pump mist when temperature is high', difficulty: 'Medium', modules: ['dht', 'pump'], pattern: 'pump_burst', op: '>', value: 30, burst: 1},
    {id: 'p027-plant-guard', name: 'Plant Guard', description: 'LED + buzz if soil is dry', difficulty: 'Medium', modules: ['soil', 'led', 'buzz'], op: '<', value: 390, freq: 880},
    {id: 'p028-water-level', name: 'Water Buddy', description: 'Distance checks water tank', difficulty: 'Medium', modules: ['ultra', 'pump'], pattern: 'pump_burst', op: '>', value: 30, burst: 2},

    // —— Safety & fire ——
    {id: 'p029-flame-led', name: 'Flame LED', description: 'LED when flame sensor trips', difficulty: 'Beginner', modules: ['flame', 'led'], op: '<', value: 320},
    {id: 'p030-flame-relay', name: 'Flame Relay', description: 'Cut power via relay on flame', difficulty: 'Medium', modules: ['flame', 'relay'], op: '<', value: 280},
    {id: 'p031-smoke-buzz', name: 'Gas Buzzer', description: 'Loud buzz on high gas', difficulty: 'Beginner', modules: ['gas', 'buzz'], op: '>', value: 650, freq: 1400},
    {id: 'p032-gas-relay', name: 'Gas Shutoff', description: 'Relay when gas is high', difficulty: 'Medium', modules: ['gas', 'relay'], op: '>', value: 720},
    {id: 'p033-gas-lamp', name: 'Gas Warning Light', description: 'RGB warning for gas', difficulty: 'Beginner', modules: ['gas', 'rgb'], op: '>', value: 680},
    {id: 'p034-fire-siren', name: 'Fire Siren', description: 'LED blink + buzz on flame', difficulty: 'Beginner', modules: ['flame', 'buzz', 'led'], op: '<', value: 300, blink: true, freq: 1600},
    {id: 'p035-kitchen-guard', name: 'Kitchen Guard', description: 'Gas + OLED + buzz alert', difficulty: 'Medium', modules: ['gas', 'oled', 'buzz'], op: '>', value: 700},
    {id: 'p036-safe-room', name: 'Safe Room', description: 'Motion + flame double check LED', difficulty: 'Medium', modules: ['pir', 'led']},

    // —— Sound ——
    {id: 'p037-noise-light', name: 'Noise Light', description: 'LED on when it is loud', difficulty: 'Beginner', modules: ['sound', 'led'], op: '>', value: 550},
    {id: 'p038-party-rgb', name: 'Party RGB', description: 'RGB flashes with loud sound', difficulty: 'Beginner', modules: ['sound', 'rgb'], op: '>', value: 580},
    {id: 'p039-quiet-please', name: 'Quiet Please', description: 'Buzz if classroom is too loud', difficulty: 'Beginner', modules: ['sound', 'buzz'], op: '>', value: 620, freq: 500},
    {id: 'p040-clap-lamp', name: 'Clap Lamp', description: 'Relay lamp on clap', difficulty: 'Medium', modules: ['sound', 'relay'], op: '>', value: 640},
    {id: 'p041-sound-meter', name: 'Sound Meter', description: 'Show loudness on OLED', difficulty: 'Beginner', modules: ['sound', 'oled'], pattern: 'display'},
    {id: 'p042-disco-motor', name: 'Disco Motor', description: 'Spin motor to the beat', difficulty: 'Medium', modules: ['sound', 'dc'], op: '>', value: 600, speed: 255},
    {id: 'p043-clap-servo', name: 'Clap Servo', description: 'Wave servo on loud sound', difficulty: 'Medium', modules: ['sound', 'servo'], op: '>', value: 610, angle: 120},
    {id: 'p044-noise-gate', name: 'Noise Gate', description: 'LED + buzz for loud rooms', difficulty: 'Beginner', modules: ['sound', 'led', 'buzz'], op: '>', value: 590, freq: 950},

    // —— Motion & distance ——
    {id: 'p045-hallway-light', name: 'Hallway Light', description: 'PIR turns LED on', difficulty: 'Beginner', modules: ['pir', 'led']},
    {id: 'p046-doorbell', name: 'Doorbell', description: 'Motion plays a tone', difficulty: 'Beginner', modules: ['pir', 'buzz'], freq: 1000},
    {id: 'p047-welcome-servo', name: 'Welcome Wave', description: 'Servo waves when motion', difficulty: 'Medium', modules: ['pir', 'servo'], angle: 80},
    {id: 'p048-auto-door', name: 'Auto Door', description: 'Distance opens a servo door', difficulty: 'Medium', modules: ['ultra', 'servo'], op: '<', value: 30, angle: 90},
    {id: 'p049-back-up-beep', name: 'Backup Beep', description: 'Beep when object is near', difficulty: 'Beginner', modules: ['ultra', 'buzz'], op: '<', value: 15, freq: 1200},
    {id: 'p050-radar-light', name: 'Radar Light', description: 'LED when something is close', difficulty: 'Beginner', modules: ['ultra', 'led'], op: '<', value: 18},
    {id: 'p051-garage-stop', name: 'Garage Stop', description: 'Stop motor when close', difficulty: 'Medium', modules: ['ultra', 'dc'], op: '<', value: 12, speed: 150},
    {id: 'p052-range-display', name: 'Range Display', description: 'Show distance in cm', difficulty: 'Beginner', modules: ['ultra', 'oled'], pattern: 'display'},
    {id: 'p053-intruder-rgb', name: 'Intruder RGB', description: 'RGB on motion', difficulty: 'Beginner', modules: ['pir', 'rgb']},
    {id: 'p054-parking-assist', name: 'Parking Assist', description: 'Near → buzz, OLED says STOP', difficulty: 'Medium', modules: ['ultra', 'buzz', 'oled'], op: '<', value: 22, thenText: 'STOP', elseText: 'GO'},

    // —— Weather / climate ——
    {id: 'p055-hot-fan', name: 'Hot Fan', description: 'Fan when temperature is high', difficulty: 'Medium', modules: ['dht', 'dc'], op: '>', value: 30, speed: 200},
    {id: 'p056-cold-lamp', name: 'Cold Lamp', description: 'LED when it is cold', difficulty: 'Medium', modules: ['dht', 'led'], op: '<', value: 18},
    {id: 'p057-humid-display', name: 'Humidity Display', description: 'Show humidity on OLED', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_humid'},
    {id: 'p058-heat-alarm', name: 'Heat Alarm', description: 'Buzz when too hot', difficulty: 'Medium', modules: ['dht', 'buzz'], op: '>', value: 32, freq: 1100},
    {id: 'p059-climate-panel', name: 'Climate Panel', description: 'Temp on OLED with wait', difficulty: 'Beginner', modules: ['dht', 'oled'], pattern: 'display_temp'},
    {id: 'p060-steam-relay', name: 'Steam Relay', description: 'Relay when humidity is high', difficulty: 'Medium', modules: ['dht', 'relay'], op: '>', value: 70},
    {id: 'p061-cozy-rgb', name: 'Cozy RGB', description: 'Warm RGB when cold', difficulty: 'Medium', modules: ['dht', 'rgb'], op: '<', value: 20},
    {id: 'p062-weather-buzz', name: 'Weather Desk', description: 'Temp display + soft buzz alert', difficulty: 'Medium', modules: ['dht', 'oled', 'buzz'], pattern: 'display_temp'},

    // —— Health ——
    {id: 'p063-pulse-led', name: 'Pulse LED', description: 'Blink LED with heart sensor', difficulty: 'Beginner', modules: ['pulse', 'led'], op: '>', value: 100, blink: true},
    {id: 'p064-pulse-buzz', name: 'Pulse Beep', description: 'Beep on heart reading', difficulty: 'Beginner', modules: ['pulse', 'buzz'], op: '>', value: 80, freq: 880},
    {id: 'p065-pulse-screen', name: 'Pulse Screen', description: 'Heart rate on OLED', difficulty: 'Beginner', modules: ['pulse', 'oled'], pattern: 'display'},
    {id: 'p066-fitness-desk', name: 'Fitness Desk', description: 'Heart + OLED + LED', difficulty: 'Medium', modules: ['pulse', 'oled', 'led'], pattern: 'display'},
    {id: 'p067-calm-light', name: 'Calm Light', description: 'RGB when pulse is high', difficulty: 'Medium', modules: ['pulse', 'rgb'], op: '>', value: 120},

    // —— Knobs & control ——
    {id: 'p068-dim-idea', name: 'Knob Lamp', description: 'Button + LED practice', difficulty: 'Beginner', modules: ['btn', 'led'], pattern: 'button_burst'},
    {id: 'p069-knob-servo', name: 'Knob Servo', description: 'Aim servo with a knob', difficulty: 'Beginner', modules: ['pot', 'servo'], pattern: 'pot_servo', angle: 90},
    {id: 'p070-knob-fan', name: 'Knob Fan', description: 'Fan speed from knob', difficulty: 'Beginner', modules: ['pot', 'dc'], pattern: 'pot_motor', speed: 200},
    {id: 'p071-knob-meter', name: 'Knob Meter', description: 'Show knob value', difficulty: 'Beginner', modules: ['pot', 'oled'], pattern: 'display'},
    {id: 'p072-knob-buzz', name: 'Theremin Toy', description: 'Buzz when knob is high', difficulty: 'Beginner', modules: ['pot', 'buzz'], op: '>', value: 2000, freq: 600},
    {id: 'p073-knob-rgb', name: 'Knob RGB', description: 'RGB on when knob twisted up', difficulty: 'Beginner', modules: ['pot', 'rgb'], op: '>', value: 2500},
    {id: 'p074-knob-relay', name: 'Knob Switch', description: 'Relay past a knob threshold', difficulty: 'Beginner', modules: ['pot', 'relay'], op: '>', value: 2800},
    {id: 'p075-knob-pump', name: 'Knob Pump', description: 'Pump when knob is high', difficulty: 'Medium', modules: ['pot', 'pump'], pattern: 'pump_burst', op: '>', value: 3000, burst: 1},

    // —— Buttons & locks ——
    {id: 'p076-panic-button', name: 'Panic Button', description: 'Button blasts the buzzer', difficulty: 'Beginner', modules: ['btn', 'buzz'], pattern: 'button_burst', freq: 1500},
    {id: 'p077-secret-door', name: 'Secret Door', description: 'Button opens servo door', difficulty: 'Beginner', modules: ['btn', 'servo'], pattern: 'button_burst'},
    {id: 'p078-big-red', name: 'Big Red Button', description: 'Button fires relay', difficulty: 'Beginner', modules: ['btn', 'relay'], pattern: 'button_burst'},
    {id: 'p079-launch-pad', name: 'Launch Pad', description: 'Button LED + buzz combo', difficulty: 'Beginner', modules: ['btn', 'led', 'buzz'], pattern: 'button_burst', freq: 1000},
    {id: 'p080-gate-keeper', name: 'Gate Keeper', description: 'Button servo + OLED hello', difficulty: 'Medium', modules: ['btn', 'servo', 'oled'], pattern: 'button_burst'},

    // —— Simple output toys ——
    {id: 'p081-heartbeat-led', name: 'Heartbeat LED', description: 'Simple LED blink loop', difficulty: 'Beginner', modules: ['led'], pattern: 'blink', wait: 0.4},
    {id: 'p082-beep-beep', name: 'Beep Beep', description: 'LED + buzz pulse loop', difficulty: 'Beginner', modules: ['led', 'buzz']},
    {id: 'p083-rgb-pulse', name: 'RGB Pulse', description: 'RGB blink practice', difficulty: 'Beginner', modules: ['rgb'], pattern: 'blink', wait: 0.5},
    {id: 'p084-servo-sweep', name: 'Servo Sweep', description: 'Button-free servo demo via ultra', difficulty: 'Beginner', modules: ['ultra', 'servo'], op: '<', value: 40, angle: 120},
    {id: 'p085-fan-demo', name: 'Fan Demo', description: 'Button spins the fan', difficulty: 'Beginner', modules: ['btn', 'dc'], pattern: 'button_burst'},

    // —— Mixed home scenes ——
    {id: 'p086-smart-desk', name: 'Smart Desk', description: 'Light sensor + OLED desk lamp', difficulty: 'Medium', modules: ['ldr', 'oled', 'led'], op: '<', value: 480},
    {id: 'p087-porch-guard', name: 'Porch Guard', description: 'Motion + distance porch alert', difficulty: 'Medium', modules: ['pir', 'buzz']},
    {id: 'p088-bath-fan', name: 'Bath Fan', description: 'Humidity starts the fan', difficulty: 'Medium', modules: ['dht', 'dc'], op: '>', value: 65, speed: 210},
    {id: 'p089-fridge-alarm', name: 'Fridge Alarm', description: 'Door motion buzzes', difficulty: 'Beginner', modules: ['pir', 'buzz'], freq: 750},
    {id: 'p090-pet-feeder', name: 'Pet Feeder', description: 'Button servo food flap', difficulty: 'Beginner', modules: ['btn', 'servo', 'led'], pattern: 'button_burst'},
    {id: 'p091-mailbox', name: 'Mail Alert', description: 'Distance detects mail', difficulty: 'Medium', modules: ['ultra', 'led', 'buzz'], op: '<', value: 10, blink: true},
    {id: 'p092-window-fan', name: 'Window Fan', description: 'Hot day → window fan', difficulty: 'Medium', modules: ['dht', 'dc', 'oled'], op: '>', value: 28, speed: 190},
    {id: 'p093-night-fan', name: 'Night Fan', description: 'Dark + hot comfort fan', difficulty: 'Medium', modules: ['ldr', 'dc'], op: '<', value: 500, speed: 160},
    {id: 'p094-study-buddy', name: 'Study Buddy', description: 'Quiet room LED for focus', difficulty: 'Beginner', modules: ['sound', 'led'], op: '<', value: 400},
    {id: 'p095-show-and-tell', name: 'Show & Tell', description: 'Knob value on the big screen', difficulty: 'Beginner', modules: ['pot', 'oled'], pattern: 'display'},

    // —— Advanced mixes (still within port caps) ——
    {id: 'p096-lab-bench', name: 'Lab Bench', description: 'Gas meter with LED warning', difficulty: 'Medium', modules: ['gas', 'led', 'oled'], op: '>', value: 690},
    {id: 'p097-robot-eye', name: 'Robot Eye', description: 'Distance aims a servo “eye”', difficulty: 'Medium', modules: ['ultra', 'servo', 'led'], op: '<', value: 35, angle: 60},
    {id: 'p098-storm-watch', name: 'Storm Watch', description: 'Sound + light storm alert', difficulty: 'Medium', modules: ['sound', 'ldr', 'buzz'], op: '>', value: 560, freq: 1300},
    {id: 'p099-eco-home', name: 'Eco Home', description: 'Soil + light garden dashboard', difficulty: 'Medium', modules: ['soil', 'oled'], pattern: 'display'},
    {id: 'p100-maker-kit', name: 'Maker Kit Demo', description: 'Button unlocks servo + lights RGB', difficulty: 'Beginner', modules: ['btn', 'servo', 'rgb'], pattern: 'button_burst'}
];

/** Advanced multi-module scenes — D4/D13/3D + A1–A4 + I2C + MD. */
const ADVANCED_SPECS = [
    {id: 'adv-smart-home', name: 'Smart Home Hub', description: 'Light + motion run lamp, buzzer, and screen', difficulty: 'Advanced', modules: ['ldr', 'pir', 'led', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'pir', thenText: 'HOME', elseText: 'IDLE', wait: 0.15},
    {id: 'adv-garden-station', name: 'Garden Station', description: 'Soil + light drive pump, LED, and OLED', difficulty: 'Advanced', modules: ['soil', 'ldr', 'pump', 'led', 'oled'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 400, burstPump: true, burst: 2, wait: 0.5},
    {id: 'adv-fire-command', name: 'Fire Command', description: 'Flame + gas trigger siren, relay, RGB, OLED', difficulty: 'Advanced', modules: ['flame', 'gas', 'buzz', 'relay', 'rgb', 'oled'], pattern: 'advanced_scene', primary: 'flame', op: '<', value: 300, freq: 1600, blink: true, thenText: 'FIRE', elseText: 'SAFE'},
    {id: 'adv-security-suite', name: 'Security Suite', description: 'PIR + distance guard with buzz, LED, servo gate', difficulty: 'Advanced', modules: ['pir', 'ultra', 'buzz', 'led', 'servo'], pattern: 'advanced_scene', primary: 'pir', blink: true, freq: 1200, angle: 90},
    {id: 'adv-parking-pro', name: 'Parking Pro', description: 'Distance + sound + OLED parking coach', difficulty: 'Advanced', modules: ['ultra', 'sound', 'buzz', 'led', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 25, blink: true, thenText: 'STOP', elseText: 'CLEAR'},
    {id: 'adv-climate-lab', name: 'Climate Lab', description: 'Temp, humidity display, fan, and warning light', difficulty: 'Advanced', modules: ['dht', 'dc', 'led', 'oled', 'buzz'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 30, speed: 220, freq: 900, thenText: 'HOT', elseText: 'OK'},
    {id: 'adv-weather-desk', name: 'Weather Desk', description: 'DHT + light + OLED weather station', difficulty: 'Advanced', modules: ['dht', 'ldr', 'oled', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 32, thenText: 'WARM', elseText: 'COOL'},
    {id: 'adv-aqua-farm', name: 'Aqua Farm', description: 'Soil + distance tank + pump + status LED', difficulty: 'Advanced', modules: ['soil', 'ultra', 'pump', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 380, burstPump: true, burst: 1.5, freq: 700},
    {id: 'adv-kitchen-safe', name: 'Kitchen Safe', description: 'Gas + flame + sound kitchen watchdog', difficulty: 'Advanced', modules: ['gas', 'flame', 'sound', 'buzz', 'relay', 'oled'], pattern: 'advanced_scene', primary: 'gas', op: '>', value: 680, freq: 1500, thenText: 'DANGER', elseText: 'OK'},
    {id: 'adv-night-patrol', name: 'Night Patrol', description: 'Dark + motion arms RGB, buzz, and OLED', difficulty: 'Advanced', modules: ['ldr', 'pir', 'rgb', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'pir', thenText: 'ALERT', elseText: 'NIGHT'},
    {id: 'adv-robot-face', name: 'Robot Face', description: 'Distance aims servo “eyes” with LED + buzz', difficulty: 'Advanced', modules: ['ultra', 'servo', 'led', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 40, angle: 75, thenText: 'HI', elseText: '...'},
    {id: 'adv-maker-console', name: 'Maker Console', description: 'Knob + button command LED, buzz, servo, OLED', difficulty: 'Advanced', modules: ['pot', 'btn', 'led', 'buzz', 'servo', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-stage-show', name: 'Stage Show', description: 'Sound + knob run RGB, motor, and buzzer', difficulty: 'Advanced', modules: ['sound', 'pot', 'rgb', 'dc', 'buzz'], pattern: 'advanced_scene', primary: 'sound', op: '>', value: 600, speed: 240, freq: 1000},
    {id: 'adv-greenhouse', name: 'Greenhouse AI', description: 'Soil + DHT + light automate pump and fan', difficulty: 'Advanced', modules: ['soil', 'dht', 'ldr', 'pump', 'dc'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 390, burstPump: true, speed: 180},
    {id: 'adv-pulse-lab', name: 'Pulse Lab', description: 'Heart + OLED + LED + buzz fitness desk', difficulty: 'Advanced', modules: ['pulse', 'oled', 'led', 'buzz', 'rgb'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 90, blink: true, freq: 880, thenText: 'BEAT', elseText: 'REST'},
    {id: 'adv-vault', name: 'Vault Lock', description: 'Button + PIR dual-check servo vault', difficulty: 'Advanced', modules: ['btn', 'pir', 'servo', 'buzz', 'oled'], pattern: 'command_center', hold: 2.5},
    {id: 'adv-storm-room', name: 'Storm Room', description: 'Sound + light + DHT storm dashboard', difficulty: 'Advanced', modules: ['sound', 'ldr', 'dht', 'buzz', 'led', 'oled'], pattern: 'advanced_scene', primary: 'sound', op: '>', value: 580, freq: 1300, thenText: 'STORM', elseText: 'CALM'},
    {id: 'adv-pet-palace', name: 'Pet Palace', description: 'Motion + distance pet door with treats servo', difficulty: 'Advanced', modules: ['pir', 'ultra', 'servo', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 20, angle: 100, blink: true},
    {id: 'adv-lab-monitor', name: 'Lab Monitor', description: 'Gas + pulse + OLED multi-sensor bench', difficulty: 'Advanced', modules: ['gas', 'pulse', 'oled', 'buzz', 'relay'], pattern: 'advanced_scene', primary: 'gas', op: '>', value: 700, thenText: 'LAB!', elseText: 'OK'},
    {id: 'adv-smart-shed', name: 'Smart Shed', description: 'Light + soil + relay shed controller', difficulty: 'Advanced', modules: ['ldr', 'soil', 'relay', 'led', 'oled', 'buzz'], pattern: 'advanced_scene', primary: 'ldr', op: '<', value: 450, thenText: 'DARK', elseText: 'DAY'},
    {id: 'adv-assist-cart', name: 'Assist Cart', description: 'Ultra + pot steer assist with motor + LED', difficulty: 'Advanced', modules: ['ultra', 'pot', 'dc', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 15, speed: 160, blink: true},
    {id: 'adv-alarm-tower', name: 'Alarm Tower', description: 'PIR + flame + gas triple-threat tower', difficulty: 'Advanced', modules: ['pir', 'flame', 'gas', 'buzz', 'rgb', 'oled'], pattern: 'advanced_scene', primary: 'pir', blink: true, freq: 1700, thenText: 'ALARM', elseText: 'WATCH'},
    {id: 'adv-hydro-desk', name: 'Hydro Desk', description: 'Soil + knob tune pump with screen feedback', difficulty: 'Advanced', modules: ['soil', 'pot', 'pump', 'oled', 'led'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 410, burstPump: true, thenText: 'WATER', elseText: 'WET'},
    {id: 'adv-gallery', name: 'Art Gallery', description: 'Sound + motion light the gallery RGB', difficulty: 'Advanced', modules: ['sound', 'pir', 'rgb', 'led', 'oled'], pattern: 'advanced_scene', primary: 'pir', thenText: 'OPEN', elseText: 'WAIT'},
    {id: 'adv-docking', name: 'Docking Bay', description: 'Distance + button docking with servo clamp', difficulty: 'Advanced', modules: ['ultra', 'btn', 'servo', 'buzz', 'oled'], pattern: 'command_center', hold: 2},
    {id: 'adv-camp-kit', name: 'Camp Kit', description: 'Light + temp camp fan and lantern', difficulty: 'Advanced', modules: ['ldr', 'dht', 'dc', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'dht', op: '>', value: 28, speed: 200},
    {id: 'adv-workshop', name: 'Workshop Bench', description: 'Knob + sound + OLED maker bench', difficulty: 'Advanced', modules: ['pot', 'sound', 'oled', 'rgb', 'buzz', 'relay'], pattern: 'advanced_scene', primary: 'sound', op: '>', value: 620, thenText: 'LOUD', elseText: 'SOFT'},
    {id: 'adv-hallway', name: 'Hallway Brain', description: 'PIR + light + ultra hallway automation', difficulty: 'Advanced', modules: ['pir', 'ldr', 'ultra', 'led', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'pir', blink: true, thenText: 'WALK', elseText: 'EMPTY'},
    {id: 'adv-eco-tower', name: 'Eco Tower', description: 'Soil + DHT + light eco dashboard + pump', difficulty: 'Advanced', modules: ['soil', 'dht', 'ldr', 'pump', 'oled', 'led'], pattern: 'advanced_scene', primary: 'soil', op: '<', value: 370, burstPump: true, thenText: 'DRY', elseText: 'OK'},
    {id: 'adv-guardian', name: 'Guardian Bot', description: 'Ultra + PIR + servo guardian with siren', difficulty: 'Advanced', modules: ['ultra', 'pir', 'servo', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 30, angle: 110, freq: 1400, thenText: 'NEAR', elseText: 'FAR'},
    {id: 'adv-control-room', name: 'Control Room', description: 'Full button console: lights, noise, gate, fan', difficulty: 'Advanced', modules: ['btn', 'led', 'buzz', 'servo', 'dc'], pattern: 'command_center', hold: 3, speed: 200, angle: 90},
    {id: 'adv-bio-lab', name: 'Bio Lab', description: 'Pulse + DHT vitals on OLED with alerts', difficulty: 'Advanced', modules: ['pulse', 'dht', 'oled', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'pulse', op: '>', value: 100, blink: true, thenText: 'VITAL', elseText: 'OK'},
    {id: 'adv-ship-bridge', name: 'Ship Bridge', description: 'Pot helm + ultra collision + motor', difficulty: 'Advanced', modules: ['pot', 'ultra', 'dc', 'buzz', 'led', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 18, speed: 140, thenText: 'COLLIDE', elseText: 'NAV'},
    {id: 'adv-farm-gate', name: 'Farm Gate', description: 'Soil + motion open gate and water', difficulty: 'Advanced', modules: ['soil', 'pir', 'servo', 'pump', 'led'], pattern: 'advanced_scene', primary: 'pir', burstPump: true, angle: 95},
    {id: 'adv-party-rig', name: 'Party Rig', description: 'Sound + knob party lights and motor', difficulty: 'Advanced', modules: ['sound', 'pot', 'rgb', 'led', 'dc', 'buzz'], pattern: 'advanced_scene', primary: 'sound', op: '>', value: 570, speed: 255, blink: true, freq: 1100},
    {id: 'adv-safe-lab', name: 'Safe Lab', description: 'Gas + flame + button emergency stop', difficulty: 'Advanced', modules: ['gas', 'flame', 'btn', 'relay', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'gas', op: '>', value: 650, freq: 1800, thenText: 'EVAC', elseText: 'LAB'},
    {id: 'adv-smart-shelf', name: 'Smart Shelf', description: 'Distance + light shelf lamp and alert', difficulty: 'Advanced', modules: ['ultra', 'ldr', 'led', 'rgb', 'buzz', 'oled'], pattern: 'advanced_scene', primary: 'ultra', op: '<', value: 12, thenText: 'ITEM', elseText: 'EMPTY'},
    {id: 'adv-rover', name: 'Mini Rover', description: 'Ultra + pot rover drive with status LED', difficulty: 'Advanced', modules: ['ultra', 'pot', 'dc', 'servo', 'led', 'buzz'], pattern: 'advanced_scene', primary: 'ultra', op: '>', value: 20, speed: 190, angle: 45, elseText: 'STOP'},
    {id: 'adv-classroom', name: 'Classroom Kit', description: 'Sound + button + OLED classroom controller', difficulty: 'Advanced', modules: ['sound', 'btn', 'oled', 'led', 'buzz', 'relay'], pattern: 'command_center', hold: 1.5},
    {id: 'adv-mega-kit', name: 'Mega Maker Kit', description: 'Max jack pack: 3 sensors + 5 actuators', difficulty: 'Advanced', modules: ['ldr', 'soil', 'pot', 'led', 'buzz', 'rgb', 'relay', 'oled'], pattern: 'advanced_scene', primary: 'ldr', op: '<', value: 500, thenText: 'MEGA', elseText: 'IDLE', wait: 0.2}
];

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
        // Skip broken specs so one bad project cannot blank the whole studio.
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[templates] skipped ${spec.id}:`, err && err.message ? err.message : err);
        }
    }
    return list;
}, []);

const templateById = id => TEMPLATES.find(t => t.id === id) || null;

const QUICK_START_IDS = [
    'night-light',
    'smart-garden',
    'security-alarm',
    'temp-display',
    'parking-sensor',
    'smart-lock'
];

const quickStartTemplates = () => QUICK_START_IDS.map(id => templateById(id)).filter(Boolean);

export {TEMPLATES, templateById, quickStartTemplates, PROJECT_SPECS, ADVANCED_SPECS};
