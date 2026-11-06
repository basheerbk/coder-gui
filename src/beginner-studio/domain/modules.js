import {K} from './tokens';

/**
 * Beginner kit catalog — only modules in the physical kit.
 * Jack rules (see ports.js):
 *   OLED / HW-605 (MAX30102) → I2C (shared bus) | L293D / 4-ch relay → MD | Stepper → ST | HC-SR04 → D5
 *   RFID → 3D (SPI) | BLE → onboard (no RJ11) | HC-05 → UART RX=3 TX=1 | analogs → A1–A4
 *   One-wire on/off parts (IR, PIR, reed, LDR, flame, buzzer, pump, solenoid) → D13 or A1–A4
 *   Cloud → onboard WiFi; A1–A4 are locked while it is wired (ADC2 + WiFi) and it excludes BLE.
 *
 * `activeLow` sensors pull their output LOW when they detect something; `offAtStart` outputs are
 * driven LOW in setup so a pump or lock never runs while the board boots.
 */
const MODULES = [
    {
        id: 'btn',
        name: 'Push Button',
        signal: 'digital',
        dir: 'in',
        category: 'input',
        color: K.accent,
        description: 'Press it to make something happen',
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
        description: 'A knob you twist to pick a number',
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
        description: 'A light you can turn on, off, blink or dim',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}},
            {type: 'set_brightness', label: 'Brightness', params: {brightness: 128}},
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
        description: 'A switch that turns a bigger gadget on or off',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'buzzer',
        name: 'Buzzer',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.orange,
        description: 'Beeps loudly when you turn it on',
        offAtStart: true,
        actions: [
            {type: 'beep', label: 'Beep', params: {ms: 200}},
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'pump',
        name: 'Water Pump',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'A small water pump for plants (plug its power adapter in too)',
        offAtStart: true,
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'solenoid',
        name: 'Solenoid Lock',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.dim,
        description: 'A door lock that opens while it is on (needs its 12 V power plug; open it for a few seconds at a time)',
        offAtStart: true,
        onOffWords: ['Open', 'Closed'],
        actions: [
            {type: 'set_on', label: 'Open / Close', params: {on: true}}
        ]
    },
    {
        id: 'servo',
        name: 'Servo Motor',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.accent,
        description: 'A motor arm that turns to the angle you choose',
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
        description: 'Spins one or two motors forward or backward, fast or slow',
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
        description: 'Four switches in one, to turn up to four gadgets on or off',
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
        description: 'A motor that turns in small, exact steps',
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
        description: 'A tiny screen for words and numbers',
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
        description: 'Smells smoke or gas in the air (warms up for about a minute)',
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
        description: 'Hears how loud it is around it',
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
        description: 'Feels your heartbeat through your fingertip',
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
        description: 'Tells if a plant\'s soil is dry or wet (0% dry to 100% wet)',
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
        description: 'Measures how warm and how damp the air is',
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
        description: 'Measures how far away something is (use the kit cable)',
        valueName: 'distance',
        valueType: 'int',
        helpers: ['getDistance'],
        actions: [
            {type: 'read_distance', label: 'Read distance'}
        ]
    },
    {
        id: 'ir',
        name: 'IR Obstacle Sensor',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.red,
        description: 'Sees when something is right in front of it (its little screw sets how close)',
        valueName: 'obstacleNear',
        valueType: 'int',
        activeLow: true,
        actions: [
            {type: 'is_detected', label: 'Something in front?'}
        ]
    },
    {
        id: 'pir',
        name: 'PIR Motion Sensor',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.green,
        description: 'Notices a person or pet moving nearby (give it a minute to wake up)',
        valueName: 'motionSeen',
        valueType: 'int',
        actions: [
            {type: 'is_detected', label: 'Motion?'}
        ]
    },
    {
        id: 'reed',
        name: 'Reed Switch',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.accent,
        description: 'Feels when a magnet is close, great for door and window alarms',
        valueName: 'magnetNear',
        valueType: 'int',
        activeLow: true,
        actions: [
            {type: 'is_detected', label: 'Magnet near?'}
        ]
    },
    {
        id: 'ldr',
        name: 'LDR Light Sensor',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.orange,
        description: 'Tells when it gets dark (its little screw sets how dark)',
        valueName: 'isDark',
        valueType: 'int',
        actions: [
            {type: 'is_detected', label: 'Is it dark?'}
        ]
    },
    {
        id: 'flame',
        name: 'Flame Sensor',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.red,
        description: 'Spots the light of a flame nearby',
        valueName: 'flameSeen',
        valueType: 'int',
        activeLow: true,
        actions: [
            {type: 'is_detected', label: 'Fire seen?'}
        ]
    },
    {
        id: 'water',
        name: 'Water Level Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.cyan,
        description: 'Tells how high the water is (only dip the striped part in)',
        valueName: 'waterLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read water level'}
        ]
    },
    {
        id: 'mpu6050',
        name: 'MPU6050 Motion',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.purple,
        description: 'Feels tilting and shaking, and lets Edge AI learn your moves',
        i2c: true,
        includes: ['Wire.h'],
        extraValues: [{name: 'tiltAngle', type: 'int', label: 'Tilt'}, {name: 'shakeLevel', type: 'int', label: 'Shake'}],
        actions: [
            {type: 'read_motion', label: 'Read motion'}
        ]
    },
    {
        id: 'rfid',
        name: 'RFID RC522',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.purple,
        description: 'Reads tag cards and key fobs',
        includes: ['SPI.h', 'MFRC522.h'],
        valueName: 'rfidUid',
        valueType: 'String',
        actions: [
            {type: 'rfid_read', label: 'Read card'}
        ]
    },
    {
        id: 'ble',
        name: 'Bluetooth (BLE)',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'Talk to a phone with Bluetooth, built into the board (no cable)',
        onboard: true,
        includes: ['BLEDevice.h', 'BLEServer.h', 'BLEUtils.h'],
        actions: [
            {type: 'ble_advertise', label: 'Turn on Bluetooth', params: {name: 'TinkerBit'}},
            {type: 'ble_send', label: 'Send text', params: {text: 'Hello'}}
        ]
    },
    {
        id: 'cloud',
        name: 'TinkerBit Cloud',
        signal: 'digital',
        dir: 'out',
        category: 'cloud',
        color: K.green,
        description: 'Send readings to your phone over WiFi and control the board from it (A ports turn off)',
        onboard: true,
        // Readings are sent automatically; these blocks are optional extras.
        autoBlock: false,
        actions: [
            {type: 'cloud_alert', label: 'Send alert', params: {text: 'Check on me!'}},
            {type: 'cloud_send_now', label: 'Send readings now'}
        ]
    },
    {
        id: 'hc05',
        name: 'HC-05 Bluetooth',
        signal: 'uart',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'Talk to a phone app over Bluetooth (unplug it if Upload fails)',
        valueName: 'hc05Line',
        valueType: 'String',
        actions: [
            {type: 'hc05_send', label: 'Send text', params: {text: 'Hello'}},
            {type: 'hc05_read', label: 'Read line'}
        ]
    }
];

/** Old template ids → current kit ids (kept for migration). */
const MODULE_ALIASES = {
    gas: 'mq2',
    sound: 'mic',
    dc: 'l293d',
    buzz: 'buzzer',
    rgb: 'led'
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
