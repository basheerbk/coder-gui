import {CONTROL_BLOCKS, MODULES, moduleById} from './modules';

const CONTROL_BY_TYPE = CONTROL_BLOCKS.reduce((acc, block) => {
    acc[block.type] = block;
    return acc;
}, {});

/*
 * One calm palette: orange = control, teal family = sensing and messages, cool blues/purples = parts
 * that do things. Every colour keeps white bold text readable in both themes.
 */
const CONTROL_COLOR = '#d97706';
const WAIT_COLOR = '#56739e';
const MESSAGE_COLOR = '#0f766e';
const SENSE_COLOR = '#0891b2';
const DEFAULT_PART_COLOR = '#6d28d9';
const MISSING_COLOR = '#6b7280';
const MESSAGE_TYPES = {serial_print: true, serial_var: true};
const PART_COLORS = {
    led: '#7c3aed',
    relay: '#2563eb',
    relay4: '#2563eb',
    buzzer: '#9333ea',
    pump: '#0369a1',
    solenoid: '#475569',
    servo: '#4f46e5',
    l293d: '#4f46e5',
    stepper: '#4f46e5',
    oled: '#0369a1',
    ble: '#1d4ed8',
    hc05: '#1d4ed8',
    cloud: '#059669'
};

/** Short names that read naturally inside a block sentence ("turn LED on", "show … on screen"). */
const PART_NAMES = {
    btn: 'button',
    pot: 'knob',
    led: 'LED',
    relay: 'relay',
    servo: 'servo',
    l293d: 'motor',
    relay4: 'relay board',
    stepper: 'stepper',
    oled: 'screen',
    mq2: 'gas sensor',
    mic: 'microphone',
    pulse: 'heartbeat sensor',
    soil: 'soil sensor',
    dht: 'climate sensor',
    ultra: 'distance sensor',
    ir: 'obstacle sensor',
    pir: 'motion sensor',
    reed: 'reed switch',
    ldr: 'light sensor',
    flame: 'flame sensor',
    water: 'water sensor',
    buzzer: 'buzzer',
    pump: 'pump',
    solenoid: 'door lock',
    rfid: 'card reader',
    ble: 'Bluetooth',
    cloud: 'Cloud',
    hc05: 'Bluetooth'
};

const actionLabelForType = (moduleDef, type) => {
    if (!moduleDef || !moduleDef.actions) {
        return null;
    }
    const action = moduleDef.actions.find(a => a.type === type);
    return action ? action.label : null;
};

/** Control blocks: If / Repeat orange; Wait and Board-message blocks get their own colour. */
const controlColor = type => {
    if (type === 'wait') {
        return WAIT_COLOR;
    }
    return MESSAGE_TYPES[type] ? MESSAGE_COLOR : CONTROL_COLOR;
};

const partColor = mod => (mod.dir === 'in' ? SENSE_COLOR : (PART_COLORS[mod.id] || DEFAULT_PART_COLOR));

/** Palette wording mirrors the sentence the block shows once it is placed. */
const PALETTE_LABELS = {
    set_on: (n, mod) => (mod && mod.onOffWords ?
        `${mod.onOffWords[0]} or close ${n}` :
        `Turn ${n} on or off`),
    set_brightness: n => `Set ${n} brightness`,
    blink: n => `Blink ${n}`,
    beep: n => `Beep ${n}`,
    set_angle: n => `Turn ${n} to an angle`,
    motor_speed: () => 'Spin a motor',
    motor_stop: () => 'Stop motors',
    relay_channel: () => 'Set one switch',
    relay_all: () => 'Set every switch',
    stepper_move: n => `Turn ${n}`,
    show_text: () => 'Show text on screen',
    show_number: () => 'Show a value on screen',
    print_gas: () => 'Write gas level',
    print_soil: () => 'Write soil moisture',
    print_climate: () => 'Write temperature & humidity',
    rfid_read: () => 'Check for a card',
    ble_advertise: () => 'Turn on Bluetooth',
    ble_send: () => 'Send over Bluetooth',
    hc05_send: () => 'Send over Bluetooth',
    hc05_read: () => 'Check for a message',
    cloud_alert: () => 'Send alert to phone',
    cloud_send_now: () => 'Send readings now',
    wait: () => 'Wait',
    repeat: () => 'Repeat',
    if_then: () => 'If … then',
    serial_print: () => 'Write text',
    serial_var: () => 'Write a value'
};

const findModuleForType = type => {
    let found = null;
    MODULES.some(m => {
        const hit = (m.actions || []).some(a => a.type === type);
        if (hit) {
            found = m;
        }
        return hit;
    });
    return found;
};

/** Friendly title, part name and accent color for canvas blocks. */
const blockMeta = (block, connections) => {
    const control = CONTROL_BY_TYPE[block.type];
    if (control) {
        const color = controlColor(block.type);
        return {
            color,
            soft: `${color}22`,
            iconId: block.type,
            label: control.label,
            kind: 'control'
        };
    }

    const conn = connections.find(c => c.id === block.cid);
    const mod = conn ? moduleById(conn.moduleId) : null;
    if (mod) {
        const color = partColor(mod);
        const actionLabel = actionLabelForType(mod, block.type) || block.type.replace(/_/g, ' ');
        return {
            color,
            soft: `${color}22`,
            iconId: mod.id,
            label: `${actionLabel} · ${mod.name}`,
            kind: mod.dir === 'in' ? 'sensor' : 'action',
            moduleName: mod.name,
            partName: PART_NAMES[mod.id] || mod.name,
            onOffWords: mod.onOffWords || null
        };
    }

    // The part this block talks to was unplugged in Build.
    const orphanMod = findModuleForType(block.type);
    if (orphanMod) {
        const actionLabel = actionLabelForType(orphanMod, block.type) || block.type;
        return {
            color: MISSING_COLOR,
            soft: `${MISSING_COLOR}22`,
            iconId: orphanMod.id,
            label: `${actionLabel} · ${orphanMod.name}`,
            kind: 'orphan',
            moduleName: orphanMod.name,
            partName: PART_NAMES[orphanMod.id] || orphanMod.name,
            onOffWords: orphanMod.onOffWords || null
        };
    }

    return {
        color: MISSING_COLOR,
        soft: `${MISSING_COLOR}22`,
        iconId: null,
        label: block.type.replace(/_/g, ' '),
        kind: 'unknown'
    };
};

const paletteChipMeta = (type, options) => {
    const {moduleId, label: overrideLabel} = options || {};
    const mod = moduleId ? moduleById(moduleId) : null;
    const control = CONTROL_BY_TYPE[type];
    const color = control ? controlColor(type) : (mod ? partColor(mod) : DEFAULT_PART_COLOR);
    const name = mod ? (PART_NAMES[mod.id] || mod.name) : '';
    const fallback = control ? control.label : (actionLabelForType(mod, type) || type.replace(/_/g, ' '));
    return {
        color,
        soft: `${color}18`,
        iconId: moduleId || type,
        label: overrideLabel || (PALETTE_LABELS[type] ? PALETTE_LABELS[type](name, mod) : fallback)
    };
};

export {blockMeta, paletteChipMeta, CONTROL_BY_TYPE, PART_NAMES};
