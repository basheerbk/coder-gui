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
        if (!mod) {
            return;
        }
        if (mod.id === 'servo' && port) {
            lines.push(`Servo servo_${port.pin};`);
        }
        if (mod.id === 'dht' && port) {
            lines.push(`DHT dht_${port.pin}(${port.pin}, DHT11);`);
        }
        if (mod.id === 'oled') {
            lines.push('Adafruit_SSD1306 display(128, 64, &Wire, -1);');
        }
        if (mod.id === 'pulse') {
            lines.push('MAX30105 pulseSensor;');
            lines.push('long pulseLastBeat = 0;');
        }
        if (mod.id === 'stepper' && port && port.pins && port.pins.length >= 4) {
            lines.push(
                `Stepper stepperMotor(200, ${port.pins[0]}, ${port.pins[1]}, ${port.pins[2]}, ${port.pins[3]});`
            );
        }
        if (mod.id === 'rfid') {
            const spi = (port && port.spi) || {ss: '32', rst: '33', miso: '34', sck: '16', mosi: '23'};
            lines.push(`#define RFID_SS_PIN ${spi.ss}`);
            lines.push(`#define RFID_RST_PIN ${spi.rst}`);
            lines.push(`#define RFID_SCK_PIN ${spi.sck}`);
            lines.push(`#define RFID_MISO_PIN ${spi.miso}`);
            lines.push(`#define RFID_MOSI_PIN ${spi.mosi}`);
            lines.push('MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);');
        }
        if (mod.id === 'ble') {
            lines.push('BLEServer *pBleServer = NULL;');
            lines.push('BLECharacteristic *pBleCharacteristic = NULL;');
            lines.push('bool bleReady = false;');
            lines.push('String bleDeviceName = "TinkerBit";');
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
        const t = vars[name];
        if (t === 'String') {
            lines.push(`String ${name} = "";`);
        } else {
            lines.push(`${t} ${name} = 0;`);
        }
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
        return [
            `servo_${pin}.setPeriodHertz(50);`,
            `servo_${pin}.attach(${pin}, 500, 2400);`,
            `servo_${pin}.write(90);`
        ];
    }
    if (mod.id === 'dht') {
        return [`dht_${pin}.begin();`];
    }
    if (mod.id === 'ultra') {
        const trig = (port.ultra && port.ultra.trig) || (port.pins && port.pins[0]);
        const echo = (port.ultra && port.ultra.echo) || (port.pins && port.pins[1]);
        if (trig && echo) {
            return [
                `// HC-SR04 on D5: Trig=${trig} OUTPUT, Echo=${echo} INPUT (never drive Echo)`,
                `pinMode(${trig}, OUTPUT);`,
                `digitalWrite(${trig}, LOW);`,
                `pinMode(${echo}, INPUT);`
            ];
        }
        return ['// HC-SR04 needs D5 (Trig+Echo) — no dual pins on this jack'];
    }
    if (mod.id === 'oled') {
        return [
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
    if (mod.id === 'pulse') {
        return [
            'if (!pulseSensor.begin(Wire, I2C_SPEED_FAST)) {',
            '  Serial.println(F("HW-605 / MAX30102 not found"));',
            '}',
            'pulseSensor.setup();',
            'pulseSensor.setPulseAmplitudeRed(0x0A);',
            'pulseSensor.setPulseAmplitudeGreen(0);'
        ];
    }
    if (mod.id === 'dc' || mod.id === 'l293d' || port.kind === 'motor') {
        const motorPins = port.pins && port.pins.length ? port.pins : [pin];
        return motorPins.map(p => `pinMode(${p}, OUTPUT);`).concat([
            'analogWrite(MOTOR_A1, 0);',
            'analogWrite(MOTOR_A2, 0);',
            'analogWrite(MOTOR_B1, 0);',
            'analogWrite(MOTOR_B2, 0);'
        ]);
    }
    if (mod.id === 'stepper' || port.kind === 'stepper') {
        const pins = port.pins && port.pins.length ? port.pins : [pin];
        return pins.map(p => `pinMode(${p}, OUTPUT);`).concat([
            'stepperMotor.setSpeed(12);'
        ]);
    }
    if (mod.id === 'rfid') {
        return [
            '// RC522 on 3D: SS/RST/MISO; SCK/MOSI on free GPIOs (D5 left for HC-SR04)',
            'SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);',
            'mfrc522.PCD_Init();'
        ];
    }
    if (mod.id === 'ble' || port.kind === 'onboard') {
        return [
            'BLEDevice::init(bleDeviceName.c_str());',
            'pBleServer = BLEDevice::createServer();',
            'BLEService *pService = pBleServer->createService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");',
            'pBleCharacteristic = pService->createCharacteristic(',
            '  "beb5483e-36e1-4688-b7f5-ea07361b26a8",',
            '  BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY',
            ');',
            'pBleCharacteristic->setValue("ready");',
            'pService->start();',
            'BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();',
            'pAdvertising->addServiceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");',
            'pAdvertising->start();',
            'bleReady = true;'
        ];
    }
    if (mod.onboard) {
        return [];
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

const ultraPins = port => {
    if (!port) {
        return null;
    }
    if (port.ultra && port.ultra.trig && port.ultra.echo) {
        return {trig: port.ultra.trig, echo: port.ultra.echo};
    }
    if (port.pins && port.pins.length >= 2) {
        return {trig: port.pins[0], echo: port.pins[1]};
    }
    return null;
};

const needsDualUltrasonic = connections =>
    (connections || []).some(c => {
        const mod = moduleById(c.moduleId);
        return mod && mod.id === 'ultra' && ultraPins(portById(c.portId));
    });

const dualDistanceHelper = () => [
    'long getDistanceTrigEcho(int trigPin, int echoPin) {',
    '  // Echo must stay INPUT — driving it against HC-SR04 Echo heats the module.',
    '  pinMode(trigPin, OUTPUT);',
    '  pinMode(echoPin, INPUT);',
    '  digitalWrite(trigPin, LOW);',
    '  delayMicroseconds(2);',
    '  digitalWrite(trigPin, HIGH);',
    '  delayMicroseconds(10);',
    '  digitalWrite(trigPin, LOW);',
    '  long duration = pulseIn(echoPin, HIGH, 30000);',
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
    case 'motor_speed': {
        const speedExpr = p.speedVar
            ? `map(constrain((int)${p.speedVar}, 0, 4095), 0, 4095, 0, 255)`
            : String(Number(p.speed) || 0);
        const channel = (p.motor === 'B' || p.channel === 'B') ? 'B' : 'A';
        const reverse = p.dir === 'backward' || p.reverse === true;
        if (port && (port.kind === 'motor' || (mod && mod.id === 'l293d'))) {
            const pin1 = channel === 'B' ? 'MOTOR_B1' : 'MOTOR_A1';
            const pin2 = channel === 'B' ? 'MOTOR_B2' : 'MOTOR_A2';
            if (reverse) {
                lines.push(indent(level, `analogWrite(${pin1}, 0);`));
                lines.push(indent(level, `analogWrite(${pin2}, ${speedExpr});`));
            } else {
                lines.push(indent(level, `analogWrite(${pin1}, ${speedExpr});`));
                lines.push(indent(level, `analogWrite(${pin2}, 0);`));
            }
        } else {
            lines.push(indent(level, `analogWrite(${pin}, ${speedExpr});`));
        }
        break;
    }
    case 'motor_stop':
        if (port && (port.kind === 'motor' || (mod && mod.id === 'l293d'))) {
            lines.push(indent(level, 'analogWrite(MOTOR_A1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_A2, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B2, 0);'));
        } else {
            lines.push(indent(level, `analogWrite(${pin}, 0);`));
        }
        break;
    case 'stepper_move':
        lines.push(indent(level, `stepperMotor.setSpeed(${Number(p.rpm) || 12});`));
        lines.push(indent(level, `stepperMotor.step(${Number(p.steps) || 100});`));
        break;
    case 'rfid_read':
        lines.push(indent(level, 'if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {'));
        lines.push(indent(level + 1, 'rfidUid = "";'));
        lines.push(indent(level + 1, 'for (byte i = 0; i < mfrc522.uid.size; i++) {'));
        lines.push(indent(level + 2, 'if (mfrc522.uid.uidByte[i] < 0x10) rfidUid += "0";'));
        lines.push(indent(level + 2, 'rfidUid += String(mfrc522.uid.uidByte[i], HEX);'));
        lines.push(indent(level + 1, '}'));
        lines.push(indent(level + 1, 'mfrc522.PICC_HaltA();'));
        lines.push(indent(level, '}'));
        break;
    case 'ble_advertise': {
        const name = String(p.name || 'TinkerBit').replace(/\\/g, '').replace(/"/g, '');
        lines.push(indent(level, `bleDeviceName = "${name}";`));
        lines.push(indent(level, 'if (bleReady) {'));
        lines.push(indent(level + 1, 'BLEDevice::getAdvertising()->stop();'));
        lines.push(indent(level + 1, 'BLEDevice::getAdvertising()->start();'));
        lines.push(indent(level, '}'));
        break;
    }
    case 'ble_send':
        lines.push(indent(level, `if (bleReady && pBleCharacteristic) {`));
        lines.push(indent(level + 1, `pBleCharacteristic->setValue("${String(p.text || '').replace(/"/g, '\\"')}");`));
        lines.push(indent(level + 1, 'pBleCharacteristic->notify();'));
        lines.push(indent(level, '}'));
        break;
    case 'read_value':
        if (mod && mod.id === 'pulse') {
            lines.push(indent(level, '{'));
            lines.push(indent(level + 1, 'long irValue = pulseSensor.getIR();'));
            lines.push(indent(level + 1, 'if (checkForBeat(irValue)) {'));
            lines.push(indent(level + 2, 'long delta = millis() - pulseLastBeat;'));
            lines.push(indent(level + 2, 'pulseLastBeat = millis();'));
            lines.push(indent(level + 2, 'if (delta > 0) heartRate = (int)(60000.0 / delta);'));
            lines.push(indent(level + 1, '}'));
            lines.push(indent(level + 1, 'if (irValue < 50000) heartRate = 0;'));
            lines.push(indent(level, '}'));
            break;
        }
        if (port && port.adc === 2) {
            lines.push(indent(level, `// ${port.label} is ADC2 (GPIO ${pin}) — analogRead can fail if WiFi is on`));
        }
        lines.push(indent(level, `${(mod && mod.valueName) || 'value'} = analogRead(${pin});`));
        break;
    case 'is_pressed':
        lines.push(indent(level, `${(mod && mod.valueName) || 'buttonState'} = digitalRead(${pin}) == LOW;`));
        break;
    case 'read_distance': {
        const ue = ultraPins(port);
        if (ue) {
            lines.push(indent(level,
                `${(mod && mod.valueName) || 'distance'} = getDistanceTrigEcho(${ue.trig}, ${ue.echo});`));
        } else {
            lines.push(indent(level, '// HC-SR04 must use D5 (Trig IO26 + Echo IO25) — skipped'));
            lines.push(indent(level, `${(mod && mod.valueName) || 'distance'} = 0;`));
        }
        break;
    }
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

const findBleName = blocks => {
    let found = null;
    const walk = list => {
        (list || []).forEach(block => {
            if (found) {
                return;
            }
            if (block.type === 'ble_advertise' && block.params && block.params.name) {
                found = String(block.params.name);
                return;
            }
            walk(block.children);
            walk(block.elseChildren);
        });
    };
    walk(blocks);
    return found;
};

const generateArduino = (connections, program) => {
    const connById = connectionLookup(connections);
    const includes = collectIncludes(connections);
    const globals = collectGlobals(connections);
    const bleName = findBleName(program);
    if (bleName) {
        const safe = bleName.replace(/\\/g, '').replace(/"/g, '');
        const idx = globals.findIndex(g => g.indexOf('bleDeviceName') !== -1);
        if (idx !== -1) {
            globals[idx] = `String bleDeviceName = "${safe}";`;
        }
    }
    const setupBody = ['Serial.begin(9600);'];
    const needsWire = (connections || []).some(c => {
        const mod = moduleById(c.moduleId);
        return mod && (mod.i2c || mod.id === 'oled' || mod.id === 'pulse');
    });
    if (needsWire) {
        setupBody.push('Wire.begin(SDA_PIN, SCL_PIN);');
    }
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
    out.push('// D5 jack Trig=IO26 Echo=IO25  D13=33  3D SS=32 RST=33 MISO=34');
    out.push('// RFID SPI bus SCK=16 MOSI=23 (D5 free for HC-SR04)  ST=12,13,14,27');
    out.push('// MD jack: Motor A=IO17/IO5  Motor B=IO18/IO19');
    out.push('// I2C SDA=21 SCL=22 (OLED + HW-605/MAX30102)  BLE=onboard');
    out.push('// Analog ADC2: A1=4 A2=15 A3=2 A4=0 (A4 is BOOT — do not hold LOW at reset)');
    out.push('// Requires ESP32Servo + SparkFun MAX3010x (for HW-605) libraries');
    out.push('// Use Upload in the Code tab (Chrome/Edge + Web Serial).');
    out.push('');
    out.push('#define SDA_PIN 21');
    out.push('#define SCL_PIN 22');
    out.push('#define MOTOR_A1 17');
    out.push('#define MOTOR_A2 5');
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
    if (needsDualUltrasonic(connections)) {
        dualDistanceHelper().forEach(l => out.push(l));
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
