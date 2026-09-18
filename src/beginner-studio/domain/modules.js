import {K} from './tokens';

/**
 * Beginner kit catalog — only modules in the physical kit.
 * Jack rules (see ports.js):
 *   OLED / HW-605 (MAX30102) → I2C (shared bus) | L293D / 4-ch relay → MD | Stepper → ST | HC-SR04 → D5
 *   RFID → 3D (SPI) | BLE → onboard (no RJ11) | analogs → A1–A4
 */
const MODULES = [
    {
        id: 'btn',
        name: 'Push Button',
        signal: 'digital',
        dir: 'in',
        category: 'input',
        color: K.accent,
        description: 'Is the button pressed?',
        valueName: 'buttonState',
        valueType: 'int',
        pinMode: 'INPUT_PULLUP',
        actions: [
            {type: 'is_pressed', label: 'Is pressed?'}
        ]
    },
    {
        id: 'pot',
        name: 'Potentiometer',
        signal: 'analog',
        dir: 'in',
        category: 'input',
        color: K.purple,
        description: 'Twist to pick a value 0–4095',
        valueName: 'knobValue',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read knob'}
        ]
    },
    {
        id: 'led',
        name: 'LED',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.purple,
        description: 'Turn a light on, off, or blink',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}},
            {type: 'blink', label: 'Blink', params: {ms: 500}}
        ]
    },
    {
        id: 'relay',
        name: 'Relay Module',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.orange,
        description: 'Switch a bigger device on or off',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'servo',
        name: 'Servo Motor',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.accent,
        description: 'Rotate to an angle (ESP32Servo)',
        includes: ['ESP32Servo.h'],
        actions: [
            {type: 'set_angle', label: 'Set angle', params: {angle: 90}}
        ]
    },
    {
        id: 'l293d',
        name: 'L293D Motor Driver',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.dim,
        description: 'Drive 1–2 DC motors on MD (A: IO17/5, B: IO18/19)',
        actions: [
            {type: 'motor_speed', label: 'Set speed', params: {speed: 180, motor: 'A', dir: 'forward'}},
            {type: 'motor_stop', label: 'Stop motors'}
        ]
    },
    {
        id: 'relay4',
        name: '4-Ch Relay (MD)',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.orange,
        description: '4-channel relay on MD — CH1=IO17, CH2=IO5, CH3=IO18, CH4=IO19 (active-LOW)',
        actions: [
            {type: 'relay_channel', label: 'Channel on/off', params: {channel: 1, on: true}},
            {type: 'relay_all', label: 'All channels', params: {on: false}}
        ]
    },
    {
        id: 'stepper',
        name: 'Stepper Motor',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.dim,
        description: 'Step a 4-wire motor — plug into ST',
        includes: ['Stepper.h'],
        actions: [
            {type: 'stepper_move', label: 'Move steps', params: {steps: 100, rpm: 12}}
        ]
    },
    {
        id: 'oled',
        name: 'OLED Screen',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'Show text or a number — plug into I2C (shared with HW-605)',
        i2c: true,
        includes: ['Wire.h', 'Adafruit_SSD1306.h', 'Adafruit_GFX.h'],
        actions: [
            {type: 'show_text', label: 'Show text', params: {text: 'Hello'}},
            {type: 'show_number', label: 'Show number', params: {varName: 'value'}}
        ]
    },
    {
        id: 'mq2',
        name: 'MQ-2 Gas Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.muted,
        description: 'Raw smoke/gas ADC 0–4095 (heater needs ~1 min). Not calibrated ppm.',
        valueName: 'gasLevel',
        valueType: 'int',
        actions: [
            {type: 'print_gas', label: 'Print gas level'},
            {type: 'read_value', label: 'Read gas'}
        ]
    },
    {
        id: 'mic',
        name: 'Microphone',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.orange,
        description: 'Read loudness from the mic',
        valueName: 'soundLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read mic'}
        ]
    },
    {
        id: 'pulse',
        name: 'Heartbeat HW-605',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.red,
        description: 'MAX30102 heart rate — plug into I2C (shares bus with OLED)',
        i2c: true,
        includes: ['Wire.h', 'MAX30105.h', 'heartRate.h'],
        valueName: 'heartRate',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read heartbeat'}
        ]
    },
    {
        id: 'soil',
        name: 'Capacitive Soil Moisture',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.green,
        description: 'Capacitive probe — dry ≈ high ADC (~2800+), wet ≈ low (~1500). Plug into A1–A4.',
        valueName: 'soilMoisture',
        valueType: 'int',
        actions: [
            {type: 'print_soil', label: 'Print soil moisture'},
            {type: 'read_value', label: 'Read soil'}
        ]
    },
    {
        id: 'dht',
        name: 'DHT11 Temp & Humid',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.orange,
        description: 'Temperature and humidity — plug into A1 (IO4). Avoid D13 for DHT.',
        includes: [],
        valueName: 'temperature',
        valueType: 'float',
        humidityName: 'humidity',
        helpers: ['dht11'],
        actions: [
            {type: 'print_climate', label: 'Print temp & humidity'},
            {type: 'read_temp', label: 'Read temperature'},
            {type: 'read_humidity', label: 'Read humidity'}
        ]
    },
    {
        id: 'ultra',
        name: 'HC-SR04 Ultrasonic',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.cyan,
        description: 'Distance in cm — D5 only (Trig IO26, Echo IO25). Use the kit cable; Echo must stay 3.3V.',
        valueName: 'distance',
        valueType: 'int',
        helpers: ['getDistance'],
        actions: [
            {type: 'read_distance', label: 'Read distance'}
        ]
    },
    {
        id: 'rfid',
        name: 'RFID RC522',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.purple,
        description: 'Read RFID tags — plug into 3D (SPI; leave D13 free)',
        includes: ['SPI.h', 'MFRC522.h'],
        valueName: 'rfidUid',
        valueType: 'String',
        actions: [
            {type: 'rfid_read', label: 'Read card UID'}
        ]
    },
    {
        id: 'ble',
        name: 'Bluetooth (BLE)',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'ESP32 built-in BLE — no RJ11 needed',
        onboard: true,
        includes: ['BLEDevice.h', 'BLEServer.h', 'BLEUtils.h'],
        actions: [
            {type: 'ble_advertise', label: 'Start advertising', params: {name: 'TinkerBit'}},
            {type: 'ble_send', label: 'Send text', params: {text: 'Hello'}}
        ]
    }
];

/** Old template ids → current kit ids (kept for migration). */
const MODULE_ALIASES = {
    gas: 'mq2',
    sound: 'mic',
    dc: 'l293d',
    buzz: 'relay',
    rgb: 'led',
    ldr: 'pot',
    flame: 'mq2',
    pir: 'btn',
    pump: 'relay'
};

const CONTROL_BLOCKS = [
    {type: 'wait', label: 'Wait', params: {seconds: 1}},
    {type: 'repeat', label: 'Repeat', params: {count: 3}, container: true},
    {type: 'if_then', label: 'If…then', params: {sensor: '', op: '<', value: 500}, container: true, hasElse: true},
    {type: 'serial_print', label: 'Print text', params: {text: 'Hello'}},
    {type: 'serial_var', label: 'Print variable', params: {varName: 'value'}}
];

const resolveModuleId = id => MODULE_ALIASES[id] || id;

const moduleById = id => {
    const resolved = resolveModuleId(id);
    return MODULES.find(m => m.id === resolved) || null;
};

export {MODULES, CONTROL_BLOCKS, MODULE_ALIASES, resolveModuleId, moduleById};
