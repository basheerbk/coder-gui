import {K} from './tokens';

const MODULES = [
    {
        id: 'led',
        name: 'LED Light',
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
        id: 'buzz',
        name: 'Buzzer',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.orange,
        description: 'Play or stop a tone',
        actions: [
            {type: 'play_tone', label: 'Play tone', params: {freq: 1000}},
            {type: 'stop_tone', label: 'Stop tone'}
        ]
    },
    {
        id: 'oled',
        name: 'OLED Screen',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'Show text or a number — plug into I2C',
        includes: ['Wire.h', 'Adafruit_SSD1306.h', 'Adafruit_GFX.h'],
        actions: [
            {type: 'show_text', label: 'Show text', params: {text: 'Hello'}},
            {type: 'show_number', label: 'Show number', params: {varName: 'value'}}
        ]
    },
    {
        id: 'servo',
        name: 'Servo Motor',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.accent,
        description: 'Rotate to an angle',
        includes: ['Servo.h'],
        actions: [
            {type: 'set_angle', label: 'Set angle', params: {angle: 90}}
        ]
    },
    {
        id: 'dc',
        name: 'DC Motor',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.dim,
        description: 'Spin a motor at a speed — plug into MD',
        actions: [
            {type: 'motor_speed', label: 'Set speed', params: {speed: 180}},
            {type: 'motor_stop', label: 'Stop motor'}
        ]
    },
    {
        id: 'pump',
        name: 'Water Pump',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.cyan,
        description: 'Pump water on or off',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'relay',
        name: 'Relay Switch',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.orange,
        description: 'Switch a bigger device',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'rgb',
        name: 'RGB LED',
        signal: 'digital',
        dir: 'out',
        category: 'output',
        color: K.purple,
        description: 'Colorful LED on or off',
        actions: [
            {type: 'set_on', label: 'On / Off', params: {on: true}}
        ]
    },
    {
        id: 'ldr',
        name: 'Light Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.analog,
        description: 'Read brightness',
        valueName: 'lightLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read light'}
        ]
    },
    {
        id: 'soil',
        name: 'Soil Moisture',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.green,
        description: 'Read how wet soil is',
        valueName: 'soilMoisture',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read soil'}
        ]
    },
    {
        id: 'gas',
        name: 'Gas Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.muted,
        description: 'Read gas level',
        valueName: 'gasLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read gas'}
        ]
    },
    {
        id: 'flame',
        name: 'Flame Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.red,
        description: 'Detect flame intensity',
        valueName: 'flameLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read flame'}
        ]
    },
    {
        id: 'sound',
        name: 'Sound Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.orange,
        description: 'Read loudness',
        valueName: 'soundLevel',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read sound'}
        ]
    },
    {
        id: 'pulse',
        name: 'Heart Sensor',
        signal: 'analog',
        dir: 'in',
        category: 'sensor',
        color: K.red,
        description: 'Read heart rate',
        valueName: 'heartRate',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read heart'}
        ]
    },
    {
        id: 'pot',
        name: 'Knob',
        signal: 'analog',
        dir: 'in',
        category: 'input',
        color: K.purple,
        description: 'Twist to pick a value',
        valueName: 'knobValue',
        valueType: 'int',
        actions: [
            {type: 'read_value', label: 'Read knob'}
        ]
    },
    {
        id: 'btn',
        name: 'Button',
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
        id: 'ultra',
        name: 'Distance',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.cyan,
        description: 'Measure distance in cm',
        valueName: 'distance',
        valueType: 'int',
        helpers: ['getDistance'],
        actions: [
            {type: 'read_distance', label: 'Read distance'}
        ]
    },
    {
        id: 'dht',
        name: 'Temp & Humid',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.orange,
        description: 'Temperature and humidity',
        includes: ['DHT.h'],
        valueName: 'temperature',
        valueType: 'float',
        humidityName: 'humidity',
        actions: [
            {type: 'read_temp', label: 'Read temperature'},
            {type: 'read_humidity', label: 'Read humidity'}
        ]
    },
    {
        id: 'pir',
        name: 'Motion',
        signal: 'digital',
        dir: 'in',
        category: 'sensor',
        color: K.green,
        description: 'Detect motion nearby',
        valueName: 'motionDetected',
        valueType: 'int',
        pinMode: 'INPUT',
        actions: [
            {type: 'is_motion', label: 'Is motion?'}
        ]
    }
];

const CONTROL_BLOCKS = [
    {type: 'wait', label: 'Wait', params: {seconds: 1}},
    {type: 'repeat', label: 'Repeat', params: {count: 3}, container: true},
    {type: 'if_then', label: 'If…then', params: {sensor: '', op: '<', value: 500}, container: true, hasElse: true},
    {type: 'serial_print', label: 'Print text', params: {text: 'Hello'}},
    {type: 'serial_var', label: 'Print variable', params: {varName: 'value'}}
];

const moduleById = id => MODULES.find(m => m.id === id) || null;

export {MODULES, CONTROL_BLOCKS, moduleById};
