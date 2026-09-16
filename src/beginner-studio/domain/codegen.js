import {moduleById} from './modules';
import {portById} from './ports';
import {formatCondition} from './condition';

const indent = (level, text) => `${'  '.repeat(level)}${text}`;

const connectionLookup = connections => {
    const byId = {};
    (connections || []).forEach(c => {
        byId[c.id] = c;
    });
    return byId;
};

const collectIncludes = connections => {
    const set = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        (mod && mod.includes ? mod.includes : []).forEach(inc => {
            set[inc] = true;
        });
    });
    return Object.keys(set);
};

const collectGlobals = connections => {
    const lines = [];
    const vars = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        const port = portById(c.portId);
        if (!mod || !port) {
            return;
        }
        if (mod.id === 'servo') {
            lines.push(`Servo servo_${port.pin};`);
        }
        if (mod.id === 'dht') {
            lines.push(`DHT dht_${port.pin}(${port.pin}, DHT11);`);
        }
        if (mod.id === 'oled') {
            lines.push('Adafruit_SSD1306 display(128, 64, &Wire, -1);');
        }
        if (mod.valueName) {
            const t = mod.valueType || 'int';
            vars[mod.valueName] = t;
        }
        if (mod.humidityName) {
            vars[mod.humidityName] = 'float';
        }
    });
    Object.keys(vars).forEach(name => {
        lines.push(`${vars[name]} ${name} = 0;`);
    });
    return lines;
};

const setupLinesForConnection = c => {
    const mod = moduleById(c.moduleId);
    const port = portById(c.portId);
    if (!mod || !port) {
        return [];
    }
    const pin = port.pin;
    if (mod.id === 'servo') {
        return [`servo_${pin}.attach(${pin});`];
    }
    if (mod.id === 'dht') {
        return [`dht_${pin}.begin();`];
    }
    if (mod.id === 'oled' || port.kind === 'i2c') {
        return [
            'Wire.begin(SDA_PIN, SCL_PIN);',
            'if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {',
            '  Serial.println(F("SSD1306 alloc failed"));',
            '}',
            'display.clearDisplay();',
            'display.setTextSize(1);',
            'display.setTextColor(SSD1306_WHITE);',
            'display.setCursor(0, 0);',
            'display.display();'
        ];
    }
    if (mod.id === 'dc' || port.kind === 'motor') {
        const motorPins = port.pins && port.pins.length ? port.pins : [pin];
        return motorPins.map(p => `pinMode(${p}, OUTPUT);`).concat([
            'analogWrite(MOTOR_A1, 0);',
            'analogWrite(MOTOR_A2, 0);',
            'analogWrite(MOTOR_B1, 0);',
            'analogWrite(MOTOR_B2, 0);'
        ]);
    }
    if (mod.dir === 'out') {
        const lines = [`pinMode(${pin}, OUTPUT);`];
        if (port.boot) {
            lines.unshift('// IO0 (A4) is a boot pin — do not hold LOW during reset.');
        }
        return lines;
    }
    const mode = mod.pinMode || 'INPUT';
    return [`pinMode(${pin}, ${mode});`];
};

const needsDistanceHelper = connections =>
    (connections || []).some(c => moduleById(c.moduleId) && moduleById(c.moduleId).id === 'ultra');

const distanceHelper = () => [
    'long getDistance(int trigPin) {',
    '  // Single-pin ultrasonic: pulse then listen',
    '  pinMode(trigPin, OUTPUT);',
    '  digitalWrite(trigPin, LOW);',
    '  delayMicroseconds(2);',
    '  digitalWrite(trigPin, HIGH);',
    '  delayMicroseconds(10);',
    '  digitalWrite(trigPin, LOW);',
    '  pinMode(trigPin, INPUT);',
    '  long duration = pulseIn(trigPin, HIGH, 30000);',
    '  return duration * 0.034 / 2;',
    '}'
];

const emitLeaf = (block, connById, level) => {
    const lines = [];
    const conn = block.cid ? connById[block.cid] : null;
    const mod = conn ? moduleById(conn.moduleId) : null;
    const port = conn ? portById(conn.portId) : null;
    const pin = port ? port.pin : '?';
    const p = block.params || {};

    switch (block.type) {
    case 'set_on':
        lines.push(indent(level, `digitalWrite(${pin}, ${p.on === false ? 'LOW' : 'HIGH'});`));
        break;
    case 'turn_on': // legacy
        lines.push(indent(level, `digitalWrite(${pin}, HIGH);`));
        break;
    case 'turn_off': // legacy
        lines.push(indent(level, `digitalWrite(${pin}, LOW);`));
        break;
    case 'blink':
        lines.push(indent(level, `digitalWrite(${pin}, HIGH);`));
        lines.push(indent(level, `delay(${Number(p.ms) || 500});`));
        lines.push(indent(level, `digitalWrite(${pin}, LOW);`));
        lines.push(indent(level, `delay(${Number(p.ms) || 500});`));
        break;
    case 'play_tone':
        lines.push(indent(level, `tone(${pin}, ${Number(p.freq) || 1000});`));
        break;
    case 'stop_tone':
        lines.push(indent(level, `noTone(${pin});`));
        break;
    case 'show_text':
        lines.push(indent(level, 'display.clearDisplay();'));
        lines.push(indent(level, 'display.setCursor(0, 0);'));
        lines.push(indent(level, `display.println(F("${String(p.text || '').replace(/"/g, '\\"')}"));`));
        lines.push(indent(level, 'display.display();'));
        break;
    case 'show_number':
        lines.push(indent(level, 'display.clearDisplay();'));
        lines.push(indent(level, 'display.setCursor(0, 0);'));
        lines.push(indent(level, `display.println(${p.varName || 'value'});`));
        lines.push(indent(level, 'display.display();'));
        break;
    case 'set_angle':
        lines.push(indent(level, `servo_${pin}.write(${Number(p.angle) || 90});`));
        break;
    case 'motor_speed':
        if (port && port.kind === 'motor') {
            lines.push(indent(level, `analogWrite(MOTOR_A1, ${Number(p.speed) || 0});`));
            lines.push(indent(level, 'analogWrite(MOTOR_A2, 0);'));
        } else {
            lines.push(indent(level, `analogWrite(${pin}, ${Number(p.speed) || 0});`));
        }
        break;
    case 'motor_stop':
        if (port && port.kind === 'motor') {
            lines.push(indent(level, 'analogWrite(MOTOR_A1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_A2, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B2, 0);'));
        } else {
            lines.push(indent(level, `analogWrite(${pin}, 0);`));
        }
        break;
    case 'read_value':
        if (port && port.adc === 2) {
            lines.push(indent(level, `// ${port.label} is ADC2 (GPIO ${pin}) — analogRead can fail if WiFi is on`));
        }
        lines.push(indent(level, `${(mod && mod.valueName) || 'value'} = analogRead(${pin});`));
        break;
    case 'is_pressed':
        lines.push(indent(level, `${(mod && mod.valueName) || 'buttonState'} = digitalRead(${pin}) == LOW;`));
        break;
    case 'read_distance':
        lines.push(indent(level, `${(mod && mod.valueName) || 'distance'} = getDistance(${pin});`));
        break;
    case 'read_temp':
        lines.push(indent(level, `temperature = dht_${pin}.readTemperature();`));
        break;
    case 'read_humidity':
        lines.push(indent(level, `humidity = dht_${pin}.readHumidity();`));
        break;
    case 'is_motion':
        lines.push(indent(level, `${(mod && mod.valueName) || 'motionDetected'} = digitalRead(${pin});`));
        break;
    case 'wait':
        lines.push(indent(level, `delay(${Math.round((Number(p.seconds) || 1) * 1000)});`));
        break;
    case 'serial_print':
        lines.push(indent(level, `Serial.println(F("${String(p.text || '').replace(/"/g, '\\"')}"));`));
        break;
    case 'serial_var':
        lines.push(indent(level, `Serial.println(${p.varName || 'value'});`));
        break;
    default:
        lines.push(indent(level, `// unknown block: ${block.type}`));
    }
    return lines;
};

const emitBlocks = (blocks, connById, level) => {
    let lines = [];
    (blocks || []).forEach(block => {
        if (block.type === 'repeat') {
            const n = Number(block.params && block.params.count) || 1;
            lines.push(indent(level, `for (int i = 0; i < ${n}; i++) {`));
            lines = lines.concat(emitBlocks(block.children, connById, level + 1));
            lines.push(indent(level, '}'));
            return;
        }
        if (block.type === 'if_then') {
            const cond = formatCondition(block.params);
            lines.push(indent(level, `if (${cond}) {`));
            lines = lines.concat(emitBlocks(block.children, connById, level + 1));
            lines.push(indent(level, '} else {'));
            lines = lines.concat(emitBlocks(block.elseChildren, connById, level + 1));
            lines.push(indent(level, '}'));
            return;
        }
        lines = lines.concat(emitLeaf(block, connById, level));
    });
    return lines;
};

const generateArduino = (connections, program) => {
    const connById = connectionLookup(connections);
    const includes = collectIncludes(connections);
    const globals = collectGlobals(connections);
    const setupBody = ['Serial.begin(9600);'];
    (connections || []).forEach(c => {
        setupLinesForConnection(c).forEach(line => setupBody.push(line));
    });
    const loopBody = emitBlocks(program, connById, 1);
    if (!loopBody.length) {
        loopBody.push(indent(1, '// Add blocks in the Code tab'));
        loopBody.push(indent(1, 'delay(100);'));
    }

    const out = [];
    out.push('// TinkerBit Beginner Studio — Maker ESP32 RJ11 map');
    out.push('// D4=25 (D5=26 same jack) D13=33 3D=32  ST=12,13,14,27');
    out.push('// MD=17,5,18,19  I2C SDA=21 SCL=22');
    out.push('// Analog ADC2: A1=4 A2=15 A3=2 A4=0 (A4 is BOOT — do not hold LOW at reset)');
    out.push('// Use Upload in the Code tab (Chrome/Edge + Web Serial).');
    out.push('');
    out.push('#define SDA_PIN 21');
    out.push('#define SCL_PIN 22');
    out.push('#define MOTOR_A1 5');
    out.push('#define MOTOR_A2 17');
    out.push('#define MOTOR_B1 18');
    out.push('#define MOTOR_B2 19');
    out.push('');
    includes.forEach(inc => out.push(`#include <${inc}>`));
    if (includes.length) {
        out.push('');
    }
    globals.forEach(g => out.push(g));
    if (globals.length) {
        out.push('');
    }
    if (needsDistanceHelper(connections)) {
        distanceHelper().forEach(l => out.push(l));
        out.push('');
    }
    out.push('void setup() {');
    setupBody.forEach(l => out.push(indent(1, l)));
    out.push('}');
    out.push('');
    out.push('void loop() {');
    loopBody.forEach(l => out.push(l));
    out.push('}');
    out.push('');
    return out.join('\n');
};

export {generateArduino};
