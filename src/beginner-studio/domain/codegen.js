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
            lines.push('unsigned long lastDhtMs = 0;');
        }
        if (mod.id === 'oled') {
            lines.push('Adafruit_SSD1306 display(128, 64, &Wire, -1);');
        }
        if (mod.id === 'pulse') {
            lines.push('MAX30105 pulseSensor;');
            lines.push('long pulseLastBeat = 0;');
            lines.push('bool pulseReady = false;');
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
        // DHT11 needs settle time after power-up; keep the data line pulled up.
        return [
            `pinMode(${pin}, INPUT_PULLUP);`,
            'delay(2000);',
            'Serial.println(F("DHT11 ready — sampling every 2s"));'
        ];
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
        // Library begin() calls Wire.begin() with no pins — re-assert SDA/SCL after.
        // Use 100 kHz: HW-605 + RJ11 often fails at 400 kHz.
        return [
            'delay(100);',
            'Wire.begin(SDA_PIN, SCL_PIN);',
            'Wire.setClock(100000);',
            'pulseReady = pulseSensor.begin(Wire, I2C_SPEED_STANDARD, 0x57);',
            'Wire.begin(SDA_PIN, SCL_PIN);',
            'Wire.setClock(100000);',
            'if (!pulseReady) {',
            '  Serial.println(F("HW-605 / MAX30102 not found — check I2C cable (SDA21/SCL22) + 3.3V"));',
            '} else {',
            '  pulseSensor.setup();',
            '  pulseSensor.setPulseAmplitudeRed(0x0A);',
            '  pulseSensor.setPulseAmplitudeGreen(0);',
            '  Serial.println(F("HW-605 ready"));',
            '}'
        ];
    }
    if (mod.id === 'mq2') {
        return [
            `analogSetPinAttenuation(${pin}, ADC_11db);`,
            'Serial.println(F("MQ-2 ready — heater needs ~1 min; values are raw 0–4095, not ppm"));'
        ];
    }
    if (mod.id === 'soil') {
        return [
            `analogSetPinAttenuation(${pin}, ADC_11db);`,
            'Serial.println(F("Capacitive soil ready — moisture 0–100% (dry=low %, wet=high %)"));'
        ];
    }
    if (mod.id === 'relay4') {
        const motorPins = port.pins && port.pins.length ? port.pins : [pin];
        // Active-LOW boards: HIGH = off at boot
        return motorPins.map(p => `pinMode(${p}, OUTPUT);`).concat([
            'digitalWrite(MOTOR_A1, HIGH);',
            'digitalWrite(MOTOR_A2, HIGH);',
            'digitalWrite(MOTOR_B1, HIGH);',
            'digitalWrite(MOTOR_B2, HIGH);',
            'Serial.println(F("4-ch relay on MD ready (CH1=17 CH2=5 CH3=18 CH4=19, active-LOW)"));'
        ]);
    }
    if (mod.id === 'dc' || mod.id === 'l293d') {
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

/** ESP32 DHT11 reader (DHTesp-style edges + portENTER_CRITICAL). */
const dht11Helper = () => [
    'bool sampleDht11Once(uint8_t pin, float *temperatureC, float *humidityPct) {',
    '  uint16_t rawHumidity = 0;',
    '  uint16_t rawTemperature = 0;',
    '  uint16_t data = 0;',
    '  // Start signal ≥18ms low',
    '  digitalWrite(pin, LOW);',
    '  pinMode(pin, OUTPUT);',
    '  delay(20);',
    '  pinMode(pin, INPUT_PULLUP);',
    '  // 83 edges: response + 40 data bits (must not be preempted on ESP32)',
    '  portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;',
    '  portENTER_CRITICAL(&mux);',
    '  for (int8_t i = -3; i < 80; i++) {',
    '    unsigned long startTime = micros();',
    '    unsigned long age = 0;',
    '    do {',
    '      age = micros() - startTime;',
    '      if (age > 90) {',
    '        portEXIT_CRITICAL(&mux);',
    '        return false;',
    '      }',
    '    } while (digitalRead(pin) == ((i & 1) ? HIGH : LOW));',
    '    if (i >= 0 && (i & 1)) {',
    '      data <<= 1;',
    '      if (age > 30) data |= 1;',
    '    }',
    '    if (i == 31) rawHumidity = data;',
    '    if (i == 63) { rawTemperature = data; data = 0; }',
    '  }',
    '  portEXIT_CRITICAL(&mux);',
    '  uint8_t sum = (uint8_t)rawHumidity + (uint8_t)(rawHumidity >> 8) + (uint8_t)rawTemperature + (uint8_t)(rawTemperature >> 8);',
    '  if (sum != (uint8_t)data) return false;',
    '  float h = (rawHumidity >> 8) + (rawHumidity & 0xFF) * 0.1f;',
    '  float t = (rawTemperature >> 8) + (rawTemperature & 0x7F) * 0.1f;',
    '  if (rawTemperature & 0x80) t = -t;',
    '  if (isnan(h) || isnan(t) || h > 100 || t > 60 || h < 0) return false;',
    '  *humidityPct = h;',
    '  *temperatureC = t;',
    '  return true;',
    '}',
    '',
    'bool sampleDht11(uint8_t pin, float *temperatureC, float *humidityPct) {',
    '  for (int attempt = 0; attempt < 3; attempt++) {',
    '    if (attempt) delay(250);',
    '    if (sampleDht11Once(pin, temperatureC, humidityPct)) return true;',
    '  }',
    '  return false;',
    '}'
];

const needsDht11Helper = connections =>
    (connections || []).some(c => {
        const mod = moduleById(c.moduleId);
        return mod && mod.id === 'dht';
    });

const needsAnalogAvgHelper = connections =>
    (connections || []).some(c => {
        const mod = moduleById(c.moduleId);
        return mod && (mod.signal === 'analog' || mod.id === 'mq2' || mod.id === 'mic' ||
            mod.id === 'soil' || mod.id === 'pot');
    });

/** Average ADC samples — MQ-2/mic raw reads swing wildly if polled every loop. */
const analogAvgHelper = () => [
    'int readAnalogAvg(int pin, int samples) {',
    '  long sum = 0;',
    '  for (int i = 0; i < samples; i++) {',
    '    sum += analogRead(pin);',
    '    delay(2);',
    '  }',
    '  return (int)(sum / samples);',
    '}',
    '',
    '// Capacitive soil: dry ≈ high ADC, wet ≈ low ADC → 0–100% moisture',
    '// Calibrated for common v1.2 modules @ 3.3V (air≈3200, water≈1200).',
    'int soilRawToPercent(int raw) {',
    '  const int dryRaw = 3200;',
    '  const int wetRaw = 1200;',
    '  if (raw <= 50) return -1; // ADC dead / wrong pin',
    '  int pct = map(constrain(raw, wetRaw, dryRaw), dryRaw, wetRaw, 0, 100);',
    '  if (pct < 0) pct = 0;',
    '  if (pct > 100) pct = 100;',
    '  return pct;',
    '}'
];

const emitLeaf = (block, connById, level) => {
    const lines = [];
    const conn = block.cid ? connById[block.cid] : null;
    const mod = conn ? moduleById(conn.moduleId) : null;
    const port = conn ? portById(conn.portId) : null;
    const pin = port ? port.pin : '?';
    const p = block.params || {};
    const modLabel = mod ? mod.name : (block.type || 'block');
    const serialLabel = (msg, valueExpr) => {
        if (valueExpr == null) {
            lines.push(indent(level, `Serial.println(F("${String(msg).replace(/"/g, '\\"')}"));`));
            return;
        }
        lines.push(indent(level, `Serial.print(F("${String(msg).replace(/"/g, '\\"')}"));`));
        lines.push(indent(level, `Serial.println(${valueExpr});`));
    };

    switch (block.type) {
    case 'set_on':
        lines.push(indent(level, `digitalWrite(${pin}, ${p.on === false ? 'LOW' : 'HIGH'});`));
        serialLabel(`${modLabel}: `, p.on === false ? '"OFF"' : '"ON"');
        break;
    case 'turn_on': // legacy
        lines.push(indent(level, `digitalWrite(${pin}, HIGH);`));
        serialLabel(`${modLabel}: ON`);
        break;
    case 'turn_off': // legacy
        lines.push(indent(level, `digitalWrite(${pin}, LOW);`));
        serialLabel(`${modLabel}: OFF`);
        break;
    case 'blink':
        lines.push(indent(level, `digitalWrite(${pin}, HIGH);`));
        lines.push(indent(level, `delay(${Number(p.ms) || 500});`));
        lines.push(indent(level, `digitalWrite(${pin}, LOW);`));
        lines.push(indent(level, `delay(${Number(p.ms) || 500});`));
        serialLabel(`${modLabel}: blink ${Number(p.ms) || 500}ms`);
        break;
    case 'play_tone':
        lines.push(indent(level, `tone(${pin}, ${Number(p.freq) || 1000});`));
        serialLabel(`${modLabel}: tone `, String(Number(p.freq) || 1000));
        break;
    case 'stop_tone':
        lines.push(indent(level, `noTone(${pin});`));
        serialLabel(`${modLabel}: tone off`);
        break;
    case 'show_text':
        lines.push(indent(level, 'display.clearDisplay();'));
        lines.push(indent(level, 'display.setCursor(0, 0);'));
        lines.push(indent(level, `display.println(F("${String(p.text || '').replace(/"/g, '\\"')}"));`));
        lines.push(indent(level, 'display.display();'));
        serialLabel(`OLED: ${String(p.text || '').replace(/"/g, '\\"')}`);
        break;
    case 'show_number':
        lines.push(indent(level, 'display.clearDisplay();'));
        lines.push(indent(level, 'display.setCursor(0, 0);'));
        lines.push(indent(level, `display.println(${p.varName || 'value'});`));
        lines.push(indent(level, 'display.display();'));
        serialLabel(`OLED ${p.varName || 'value'}=`, p.varName || 'value');
        break;
    case 'set_angle':
        lines.push(indent(level, `servo_${pin}.write(${Number(p.angle) || 90});`));
        serialLabel(`${modLabel}: angle=`, String(Number(p.angle) || 90));
        break;
    case 'relay_channel': {
        const ch = Math.min(4, Math.max(1, Number(p.channel) || 1));
        const pinName = ch === 1 ? 'MOTOR_A1' : ch === 2 ? 'MOTOR_A2' : ch === 3 ? 'MOTOR_B1' : 'MOTOR_B2';
        // Active-LOW: ON drives pin LOW
        const level = p.on === false ? 'HIGH' : 'LOW';
        lines.push(indent(level, `digitalWrite(${pinName}, ${level});`));
        serialLabel(`Relay CH${ch}: `, p.on === false ? '"OFF"' : '"ON"');
        break;
    }
    case 'relay_all': {
        const level = p.on === false ? 'HIGH' : 'LOW';
        lines.push(indent(level, `digitalWrite(MOTOR_A1, ${level});`));
        lines.push(indent(level, `digitalWrite(MOTOR_A2, ${level});`));
        lines.push(indent(level, `digitalWrite(MOTOR_B1, ${level});`));
        lines.push(indent(level, `digitalWrite(MOTOR_B2, ${level});`));
        serialLabel('Relay ALL: ', p.on === false ? '"OFF"' : '"ON"');
        break;
    }
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
            serialLabel(`Motor ${channel} ${reverse ? 'REV' : 'FWD'} spd=`, speedExpr);
        } else {
            lines.push(indent(level, `analogWrite(${pin}, ${speedExpr});`));
            serialLabel(`${modLabel}: spd=`, speedExpr);
        }
        break;
    }
    case 'motor_stop':
        if (port && (port.kind === 'motor' || (mod && mod.id === 'l293d'))) {
            lines.push(indent(level, 'analogWrite(MOTOR_A1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_A2, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B1, 0);'));
            lines.push(indent(level, 'analogWrite(MOTOR_B2, 0);'));
            serialLabel('Motors: STOP');
        } else {
            lines.push(indent(level, `analogWrite(${pin}, 0);`));
            serialLabel(`${modLabel}: STOP`);
        }
        break;
    case 'stepper_move':
        lines.push(indent(level, `stepperMotor.setSpeed(${Number(p.rpm) || 12});`));
        lines.push(indent(level, `stepperMotor.step(${Number(p.steps) || 100});`));
        serialLabel(`Stepper: ${Number(p.steps) || 100} steps @ ${Number(p.rpm) || 12} RPM`);
        break;
    case 'rfid_read':
        lines.push(indent(level, 'if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {'));
        lines.push(indent(level + 1, 'rfidUid = "";'));
        lines.push(indent(level + 1, 'for (byte i = 0; i < mfrc522.uid.size; i++) {'));
        lines.push(indent(level + 2, 'if (mfrc522.uid.uidByte[i] < 0x10) rfidUid += "0";'));
        lines.push(indent(level + 2, 'rfidUid += String(mfrc522.uid.uidByte[i], HEX);'));
        lines.push(indent(level + 1, '}'));
        lines.push(indent(level + 1, 'mfrc522.PICC_HaltA();'));
        lines.push(indent(level + 1, 'Serial.print(F("RFID UID="));'));
        lines.push(indent(level + 1, 'Serial.println(rfidUid);'));
        lines.push(indent(level, '} else {'));
        lines.push(indent(level + 1, 'Serial.println(F("RFID: no card"));'));
        lines.push(indent(level, '}'));
        break;
    case 'ble_advertise': {
        const name = String(p.name || 'TinkerBit').replace(/\\/g, '').replace(/"/g, '');
        lines.push(indent(level, `bleDeviceName = "${name}";`));
        lines.push(indent(level, 'if (bleReady) {'));
        lines.push(indent(level + 1, 'BLEDevice::getAdvertising()->stop();'));
        lines.push(indent(level + 1, 'BLEDevice::getAdvertising()->start();'));
        lines.push(indent(level + 1, `Serial.println(F("BLE advertising: ${name}"));`));
        lines.push(indent(level, '}'));
        break;
    }
    case 'ble_send':
        lines.push(indent(level, `if (bleReady && pBleCharacteristic) {`));
        lines.push(indent(level + 1, `pBleCharacteristic->setValue("${String(p.text || '').replace(/"/g, '\\"')}");`));
        lines.push(indent(level + 1, 'pBleCharacteristic->notify();'));
        lines.push(indent(level + 1, `Serial.println(F("BLE send: ${String(p.text || '').replace(/"/g, '\\"')}"));`));
        lines.push(indent(level, '}'));
        break;
    case 'print_gas':
        if (port && port.adc === 2) {
            lines.push(indent(level, `// ${port.label} GPIO ${pin} is ADC2 — keep WiFi/BLE off for stable reads`));
        }
        lines.push(indent(level, 'delay(400);'));
        lines.push(indent(level, `gasLevel = readAnalogAvg(${pin}, 16);`));
        lines.push(indent(level, 'Serial.print(F("Gas level="));'));
        lines.push(indent(level, 'Serial.print(gasLevel);'));
        lines.push(indent(level, 'Serial.println(F(" (0-4095 raw)"));'));
        break;
    case 'print_soil': {
        const portLabel = port && port.label ? port.label : '?';
        if (port && port.adc === 2) {
            lines.push(indent(level, `// ${portLabel} GPIO ${pin} is ADC2 — keep WiFi/BLE off for stable reads`));
        }
        lines.push(indent(level, 'delay(300);'));
        lines.push(indent(level, `{`));
        lines.push(indent(level + 1, `int soilRaw = readAnalogAvg(${pin}, 16);`));
        lines.push(indent(level + 1, 'int soilPct = soilRawToPercent(soilRaw);'));
        lines.push(indent(level + 1, 'if (soilPct < 0) {'));
        lines.push(indent(level + 2, `Serial.print(F("Soil FAIL raw="));`));
        lines.push(indent(level + 2, 'Serial.print(soilRaw);'));
        lines.push(indent(level + 2, `Serial.println(F(" — wrong jack/pin or no signal (expect ${portLabel}=GPIO${pin})"));`));
        lines.push(indent(level + 1, '} else {'));
        lines.push(indent(level + 2, 'soilMoisture = soilPct;'));
        lines.push(indent(level + 2, 'Serial.print(F("Soil moisture="));'));
        lines.push(indent(level + 2, 'Serial.print(soilMoisture);'));
        lines.push(indent(level + 2, 'Serial.print(F(" % (raw="));'));
        lines.push(indent(level + 2, 'Serial.print(soilRaw);'));
        lines.push(indent(level + 2, `Serial.print(F(" ${portLabel}/GPIO${pin})"));`));
        lines.push(indent(level + 2, 'Serial.println();'));
        lines.push(indent(level + 1, '}'));
        lines.push(indent(level, '}'));
        break;
    }
    case 'read_value':
        if (mod && mod.id === 'pulse') {
            lines.push(indent(level, 'if (pulseReady) {'));
            lines.push(indent(level + 1, 'long irValue = pulseSensor.getIR();'));
            lines.push(indent(level + 1, 'if (checkForBeat(irValue)) {'));
            lines.push(indent(level + 2, 'long delta = millis() - pulseLastBeat;'));
            lines.push(indent(level + 2, 'pulseLastBeat = millis();'));
            lines.push(indent(level + 2, 'if (delta > 0) heartRate = (int)(60000.0 / delta);'));
            lines.push(indent(level + 1, '}'));
            lines.push(indent(level + 1, 'if (irValue < 50000) heartRate = 0;'));
            lines.push(indent(level + 1, 'Serial.print(F("HW-605 BPM="));'));
            lines.push(indent(level + 1, 'Serial.println(heartRate);'));
            lines.push(indent(level, '} else {'));
            lines.push(indent(level + 1, 'heartRate = 0;'));
            lines.push(indent(level + 1, 'Serial.println(F("HW-605 not ready"));'));
            lines.push(indent(level + 1, 'delay(500);'));
            lines.push(indent(level, '}'));
            break;
        }
        if (mod && mod.id === 'soil') {
            const portLabel = port && port.label ? port.label : '?';
            if (port && port.adc === 2) {
                lines.push(indent(level, `// ${portLabel} GPIO ${pin} is ADC2 — keep WiFi/BLE off for stable reads`));
            }
            lines.push(indent(level, `{`));
            lines.push(indent(level + 1, `int soilRaw = readAnalogAvg(${pin}, 16);`));
            lines.push(indent(level + 1, 'int soilPct = soilRawToPercent(soilRaw);'));
            lines.push(indent(level + 1, 'if (soilPct < 0) {'));
            lines.push(indent(level + 2, 'soilMoisture = 0;'));
            lines.push(indent(level + 2, `Serial.println(F("Soil FAIL — check ${portLabel}/GPIO${pin} cable"));`));
            lines.push(indent(level + 1, '} else {'));
            lines.push(indent(level + 2, 'soilMoisture = soilPct;'));
            lines.push(indent(level + 2, 'Serial.print(F("Soil moisture="));'));
            lines.push(indent(level + 2, 'Serial.print(soilMoisture);'));
            lines.push(indent(level + 2, 'Serial.print(F(" % (raw="));'));
            lines.push(indent(level + 2, 'Serial.print(soilRaw);'));
            lines.push(indent(level + 2, 'Serial.println(F(")"));'));
            lines.push(indent(level + 1, '}'));
            lines.push(indent(level, '}'));
            break;
        }
        if (port && port.adc === 2) {
            lines.push(indent(level, `// ${port.label} GPIO ${pin} is ADC2 — keep WiFi/BLE off for stable reads`));
        }
        if (mod && (mod.signal === 'analog' || mod.id === 'mq2' || mod.id === 'mic' || mod.id === 'pot')) {
            lines.push(indent(level, `${mod.valueName || 'value'} = readAnalogAvg(${pin}, 12);`));
        } else {
            lines.push(indent(level, `${(mod && mod.valueName) || 'value'} = analogRead(${pin});`));
        }
        serialLabel(`${modLabel}: `, (mod && mod.valueName) || 'value');
        break;
    case 'is_pressed':
        lines.push(indent(level, `${(mod && mod.valueName) || 'buttonState'} = digitalRead(${pin}) == LOW;`));
        serialLabel(`${modLabel}: `, `${(mod && mod.valueName) || 'buttonState'} ? "PRESSED" : "open"`);
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
        serialLabel('HC-SR04 cm=', (mod && mod.valueName) || 'distance');
        break;
    }
    case 'read_temp':
    case 'read_humidity':
    case 'print_climate': {
        // Built-in 2s wait — DHT11 cannot be polled faster (255/NaN otherwise).
        const mode = block.type;
        lines.push(indent(level, 'delay(2000);'));
        lines.push(indent(level, `{`));
        lines.push(indent(level + 1, 'float dhtT = 0;'));
        lines.push(indent(level + 1, 'float dhtH = 0;'));
        lines.push(indent(level + 1, `bool dhtOk = sampleDht11(${pin}, &dhtT, &dhtH);`));
        lines.push(indent(level + 1, 'lastDhtMs = millis();'));
        lines.push(indent(level + 1, 'if (!dhtOk) {'));
        lines.push(indent(level + 2, 'Serial.println(F("DHT11 failed — plug into A1 (IO4), check cable power"));'));
        lines.push(indent(level + 1, '} else {'));
        lines.push(indent(level + 2, 'temperature = dhtT;'));
        lines.push(indent(level + 2, 'humidity = dhtH;'));
        if (mode === 'print_climate') {
            lines.push(indent(level + 2, 'Serial.print(F("Temp="));'));
            lines.push(indent(level + 2, 'Serial.print(temperature);'));
            lines.push(indent(level + 2, 'Serial.print(F(" C  Humidity="));'));
            lines.push(indent(level + 2, 'Serial.print(humidity);'));
            lines.push(indent(level + 2, 'Serial.println(F(" %"));'));
        } else if (mode === 'read_temp') {
            lines.push(indent(level + 2, 'Serial.print(F("Temp="));'));
            lines.push(indent(level + 2, 'Serial.print(temperature);'));
            lines.push(indent(level + 2, 'Serial.println(F(" C"));'));
        } else {
            lines.push(indent(level + 2, 'Serial.print(F("Humidity="));'));
            lines.push(indent(level + 2, 'Serial.print(humidity);'));
            lines.push(indent(level + 2, 'Serial.println(F(" %"));'));
        }
        lines.push(indent(level + 1, '}'));
        lines.push(indent(level, '}'));
        break;
    }
    case 'is_motion':
        lines.push(indent(level, `${(mod && mod.valueName) || 'motionDetected'} = digitalRead(${pin});`));
        serialLabel(`${modLabel}: `, (mod && mod.valueName) || 'motionDetected');
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
    const setupBody = ['Serial.begin(9600);', 'delay(200);', 'Serial.println(F("TinkerBit Beginner ready"));'];
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
    out.push('// MD jack: IO17/IO5/IO18/IO19 — L293D motors or 4-ch relay (active-LOW)');
    out.push('// I2C SDA=21 SCL=22 (OLED + HW-605/MAX30102)  BLE=onboard');
    out.push('// Analog ADC2: A1=4 A2=15 A3=2 A4=0 (A4 is BOOT — do not hold LOW at reset)');
    out.push('// Requires ESP32Servo + SparkFun MAX3010x (for HW-605) libraries');
    out.push('// DHT11 uses built-in bit-bang (no DHT.h) — sample every 2s');
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
    if (needsDht11Helper(connections)) {
        dht11Helper().forEach(l => out.push(l));
        out.push('');
    }
    if (needsAnalogAvgHelper(connections)) {
        analogAvgHelper().forEach(l => out.push(l));
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
