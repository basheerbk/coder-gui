/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerGenerators (Blockly) {
    const getHardware = () => {
        const hw = (typeof globalThis !== 'undefined' && globalThis.MakerEsp32Hardware) ||
            (typeof window !== 'undefined' && window.MakerEsp32Hardware) ||
            null;
        if (hw && hw.pins) {
            return hw;
        }
        // Fallback if preload missed — must match pin-map.js / board table.
        return {
            pins: {
                STEP_IN1: 12, STEP_IN2: 13, STEP_IN3: 14, STEP_IN4: 27,
                MOTOR_A1: 17, MOTOR_A2: 5, MOTOR_B1: 18, MOTOR_B2: 19,
                SDA: 21, SCL: 22,
                A1: 4, A2: 15, A3: 2, A4: 0,
                ULTRA_ECHO: 25, ULTRA_TRIG: 26, D13: 33, T3D: 32,
                RFID_SS: 32, RFID_RST: 33, RFID_MISO: 34, RFID_SCK: 16, RFID_MOSI: 23,
                UART_RX: 3, UART_TX: 1,
                SPARE1: 15, SPARE2: 2
            },
            digitalPorts: {
                D13: 'D13_PIN',
                T3D: 'T3D_PIN', '3D': 'T3D_PIN',
                A1: 'A1_PIN', A2: 'A2_PIN', A3: 'A3_PIN', A4: 'A4_PIN',
                SPARE1: 'A2_PIN', SPARE2: 'A3_PIN'
            },
            analogPorts: {
                A1: 'A1_PIN', A2: 'A2_PIN', A3: 'A3_PIN', A4: 'A4_PIN'
            }
        };
    };

    const quoteField = value => {
        const text = String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `"${text}"`;
    };

    const ensurePinDefines = () => {
        const PINS = getHardware().pins;
        Blockly.Arduino.definitions_.makerEsp32_pins = [
            '// Maker ESP32 RJ11 pin map',
            `#define STEP_IN1 ${PINS.STEP_IN1}`,
            `#define STEP_IN2 ${PINS.STEP_IN2}`,
            `#define STEP_IN3 ${PINS.STEP_IN3}`,
            `#define STEP_IN4 ${PINS.STEP_IN4}`,
            `#define MOTOR_A1 ${PINS.MOTOR_A1}`,
            `#define MOTOR_A2 ${PINS.MOTOR_A2}`,
            `#define MOTOR_B1 ${PINS.MOTOR_B1}`,
            `#define MOTOR_B2 ${PINS.MOTOR_B2}`,
            `#define SDA_PIN ${PINS.SDA}`,
            `#define SCL_PIN ${PINS.SCL}`,
            `#define A1_PIN ${PINS.A1}`,
            `#define A2_PIN ${PINS.A2}`,
            `#define A3_PIN ${PINS.A3}`,
            `#define A4_PIN ${PINS.A4}`,
            `#define ULTRA_ECHO_PIN ${PINS.ULTRA_ECHO || 25}`,
            `#define ULTRA_TRIG_PIN ${PINS.ULTRA_TRIG || 26}`,
            `#define D13_PIN ${PINS.D13}`,
            `#define T3D_PIN ${PINS.T3D}`,
            `#define RFID_SS_PIN ${PINS.RFID_SS || PINS.T3D}`,
            `#define RFID_RST_PIN ${PINS.RFID_RST || 33}`,
            `#define RFID_MISO_PIN ${PINS.RFID_MISO || 34}`,
            `#define RFID_SCK_PIN ${PINS.RFID_SCK || 16}`,
            `#define RFID_MOSI_PIN ${PINS.RFID_MOSI || 23}`,
            `#define UART_RX_PIN ${PINS.UART_RX || 3}`,
            `#define UART_TX_PIN ${PINS.UART_TX || 1}`,
            `#define SPARE1_PIN ${PINS.SPARE1}`,
            `#define SPARE2_PIN ${PINS.SPARE2}`
        ].join('\n');
    };

    const setupPin = (pinExpr, mode) => {
        Blockly.Arduino.setups_[`pinMode_${pinExpr}`] = `pinMode(${pinExpr}, ${mode});`;
    };

    const ensureMotorPins = () => {
        ensurePinDefines();
        setupPin('MOTOR_A1', 'OUTPUT');
        setupPin('MOTOR_A2', 'OUTPUT');
        setupPin('MOTOR_B1', 'OUTPUT');
        setupPin('MOTOR_B2', 'OUTPUT');
    };

    const ensureStepper = () => {
        ensurePinDefines();
        Blockly.Arduino.includes_.makerEsp32_stepper = '#include <Stepper.h>';
        Blockly.Arduino.definitions_.makerEsp32_stepper =
            'Stepper makerStepper(200, STEP_IN1, STEP_IN2, STEP_IN3, STEP_IN4);';
    };

    const digitalPinExpr = port => {
        const map = getHardware().digitalPorts;
        if (map[port]) {
            return map[port];
        }
        if (port === 'D4' || port === 'D5') {
            // Older projects offered the ultrasonic jack's two pins as on/off ports.
            Blockly.Arduino.definitions_.makerEsp32_oldPort =
                '// A block used D4/D5, the ultrasonic jack. It now uses D13: pick its jack again.';
        }
        return 'D13_PIN';
    };

    const analogPinExpr = port => {
        const map = getHardware().analogPorts;
        return map[port] || 'A1_PIN';
    };

    const ensureBlynkCore = () => {
        if (!Blockly.Arduino.definitions_.blynkIoT_timer) {
            Blockly.Arduino.definitions_.blynkIoT_timer = 'BlynkTimer blynkIoTTimer;';
        }
        Blockly.Arduino.loops_.blynkIoT_run = 'Blynk.run();';
        Blockly.Arduino.loops_.blynkIoT_timer_run = 'blynkIoTTimer.run();';
    };

    const ensureBlynkIncludes = () => {
        // Template macros must appear before Blynk headers (Blynk 2.0).
        const existing = Blockly.Arduino.includes_.blynkIoT || '';
        if (existing.indexOf('#include <BlynkSimpleEsp32.h>') === -1) {
            Blockly.Arduino.includes_.blynkIoT = [
                existing,
                '#include <WiFi.h>',
                '#include <BlynkSimpleEsp32.h>'
            ].filter(Boolean).join('\n');
        }
    };

    // --- Port I/O ---

    Blockly.Arduino.makerEsp32_setDigital = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const state = block.getFieldValue('STATE') || 'HIGH';
        setupPin(pin, 'OUTPUT');
        return `digitalWrite(${pin}, ${state});\n`;
    };

    Blockly.Arduino.makerEsp32_readDigital = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        setupPin(pin, 'INPUT');
        return [`digitalRead(${pin})`, Blockly.Arduino.ORDER_UNARY_PREFIX];
    };

    Blockly.Arduino.makerEsp32_readAnalog = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        return [`analogRead(${pin})`, Blockly.Arduino.ORDER_UNARY_PREFIX];
    };

    Blockly.Arduino.makerEsp32_setMotor = function (block) {
        ensureMotorPins();
        const motor = block.getFieldValue('MOTOR') || 'A';
        const dir = block.getFieldValue('DIR') || 'FORWARD';
        const speed = Blockly.Arduino.valueToCode(block, 'SPEED', Blockly.Arduino.ORDER_ATOMIC) || '255';
        const in1 = motor === 'B' ? 'MOTOR_B1' : 'MOTOR_A1';
        const in2 = motor === 'B' ? 'MOTOR_B2' : 'MOTOR_A2';

        if (dir === 'STOP') {
            return `analogWrite(${in1}, 0);\nanalogWrite(${in2}, 0);\n`;
        }
        if (dir === 'BACKWARD') {
            return `analogWrite(${in1}, 0);\nanalogWrite(${in2}, ${speed});\n`;
        }
        return `analogWrite(${in1}, ${speed});\nanalogWrite(${in2}, 0);\n`;
    };

    Blockly.Arduino.makerEsp32_stopMotors = function () {
        ensureMotorPins();
        return [
            'analogWrite(MOTOR_A1, 0);',
            'analogWrite(MOTOR_A2, 0);',
            'analogWrite(MOTOR_B1, 0);',
            'analogWrite(MOTOR_B2, 0);',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_stepperMove = function (block) {
        ensureStepper();
        const dir = block.getFieldValue('DIR') || 'CW';
        const steps = Blockly.Arduino.valueToCode(block, 'STEPS', Blockly.Arduino.ORDER_ATOMIC) || '200';
        const rpm = Blockly.Arduino.valueToCode(block, 'RPM', Blockly.Arduino.ORDER_ATOMIC) || '30';
        const signedSteps = dir === 'CCW' ? `-(${steps})` : steps;
        return `makerStepper.setSpeed(${rpm});\nmakerStepper.step(${signedSteps});\n`;
    };

    Blockly.Arduino.makerEsp32_initI2c = function () {
        ensurePinDefines();
        Blockly.Arduino.includes_.makerEsp32_wire = '#include <Wire.h>';
        Blockly.Arduino.setups_.makerEsp32_i2c = 'Wire.begin(SDA_PIN, SCL_PIN);';
        return '';
    };

    // --- Maker Blynk ---

    Blockly.Arduino.makerEsp32_blynkConnect = function (block) {
        const templateId = quoteField(block.getFieldValue('TEMPLATE_ID') || 'TMPLxxxxxx');
        const templateName = quoteField(block.getFieldValue('TEMPLATE_NAME') || 'Device');
        const auth = quoteField(block.getFieldValue('AUTH') || 'YourAuthToken');
        const ssid = quoteField(block.getFieldValue('SSID') || 'YourWiFi');
        const pass = quoteField(block.getFieldValue('PASS') || 'YourPassword');

        // Defines before includes (Blynk 2.0 requirement).
        Blockly.Arduino.includes_.blynkIoT = [
            `#define BLYNK_TEMPLATE_ID ${templateId}`,
            `#define BLYNK_TEMPLATE_NAME ${templateName}`,
            `#define BLYNK_AUTH_TOKEN ${auth}`,
            '#include <WiFi.h>',
            '#include <BlynkSimpleEsp32.h>'
        ].join('\n');

        ensureBlynkCore();
        Blockly.Arduino.definitions_.blynkIoT_ssid = `char blynkIoTSsid[] = ${ssid};`;
        Blockly.Arduino.definitions_.blynkIoT_pass = `char blynkIoTPass[] = ${pass};`;
        Blockly.Arduino.setups_.blynkIoT_serial = 'Serial.begin(115200);';
        Blockly.Arduino.setups_.blynkIoT_begin =
            'Blynk.begin(BLYNK_AUTH_TOKEN, blynkIoTSsid, blynkIoTPass);';
        return '';
    };

    Blockly.Arduino.makerEsp32_blynkSendDigital = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'INPUT');
        return `Blynk.virtualWrite(${vpin}, digitalRead(${pin}));\n`;
    };

    Blockly.Arduino.makerEsp32_blynkSendAnalog = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        return `Blynk.virtualWrite(${vpin}, analogRead(${pin}));\n`;
    };

    Blockly.Arduino.makerEsp32_blynkWhenSetDigital = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            `  digitalWrite(${pin}, param.asInt() ? HIGH : LOW);`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_write_${vpin}_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkWhenSetMotor = function (block) {
        ensureMotorPins();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const motor = block.getFieldValue('MOTOR') || 'A';
        const vpin = block.getFieldValue('VPIN') || 'V0';
        const in1 = motor === 'B' ? 'MOTOR_B1' : 'MOTOR_A1';
        const in2 = motor === 'B' ? 'MOTOR_B2' : 'MOTOR_A2';
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            '  int speed = param.asInt();',
            '  if (speed <= 0) {',
            `    analogWrite(${in1}, 0);`,
            `    analogWrite(${in2}, 0);`,
            '  } else {',
            `    analogWrite(${in1}, speed);`,
            `    analogWrite(${in2}, 0);`,
            '  }',
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_motor_${vpin}_${motor}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkStreamAnalog = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '1000';
        const id = block.id.replace(/[^A-Za-z0-9_]/g, '_');
        const fnName = `makerEsp32Stream_${id}`;
        Blockly.Arduino.customFunctions_[fnName] = [
            `void ${fnName}() {`,
            `  Blynk.virtualWrite(${vpin}, analogRead(${pin}));`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.setups_[`makerEsp32_stream_${id}`] =
            `blynkIoTTimer.setInterval(${ms}L, ${fnName});`;
        return '';
    };

    Blockly.Arduino.makerEsp32_blynkIsConnected = function () {
        ensureBlynkIncludes();
        ensureBlynkCore();
        return ['Blynk.connected()', Blockly.Arduino.ORDER_ATOMIC];
    };

    const ensureSerialLog = () => {
        Blockly.Arduino.setups_.blynkIoT_serial = 'Serial.begin(115200);';
    };

    Blockly.Arduino.makerEsp32_blynkSerialBegin = function () {
        ensureSerialLog();
        return '';
    };

    Blockly.Arduino.makerEsp32_blynkSerialPrint = function (block) {
        ensureSerialLog();
        const text = quoteField(block.getFieldValue('TEXT') || '');
        return `Serial.println(${text});\n`;
    };

    Blockly.Arduino.makerEsp32_blynkSerialPrintValue = function (block) {
        ensureSerialLog();
        const label = quoteField(block.getFieldValue('LABEL') || 'value');
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
        return `Serial.print(${label});\nSerial.print(": ");\nSerial.println(${value});\n`;
    };

    Blockly.Arduino.makerEsp32_blynkSerialLogConnected = function () {
        ensureSerialLog();
        ensureBlynkIncludes();
        ensureBlynkCore();
        return 'Serial.println(Blynk.connected() ? "Blynk: connected" : "Blynk: disconnected");\n';
    };

    Blockly.Arduino.makerEsp32_blynkWhenLogVirtual = function (block) {
        ensureSerialLog();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const vpin = block.getFieldValue('VPIN') || 'V0';
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            `  Serial.print("${vpin}=");`,
            '  Serial.println(param.asInt());',
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_log_${vpin}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkWhenSetLed = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            `  digitalWrite(${pin}, param.asInt() ? HIGH : LOW);`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_led_${vpin}_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkWhenSetLedBrightness = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            `  analogWrite(${pin}, constrain(param.asInt(), 0, 255));`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_ledpwm_${vpin}_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkSendButton = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'INPUT_PULLUP');
        return `Blynk.virtualWrite(${vpin}, digitalRead(${pin}) == LOW ? 1 : 0);\n`;
    };

    Blockly.Arduino.makerEsp32_blynkWhenBeep = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        setupPin(pin, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${vpin}) {`,
            '  if (param.asInt()) {',
            `    digitalWrite(${pin}, HIGH);`,
            '    delay(200);',
            `    digitalWrite(${pin}, LOW);`,
            '  }',
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`makerEsp32_blynk_beep_${vpin}_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.makerEsp32_blynkStreamButton = function (block) {
        ensurePinDefines();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const vpin = block.getFieldValue('VPIN') || 'V0';
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '200';
        setupPin(pin, 'INPUT_PULLUP');
        const id = block.id.replace(/[^A-Za-z0-9_]/g, '_');
        const fnName = `makerEsp32BtnStream_${id}`;
        Blockly.Arduino.customFunctions_[fnName] = [
            `void ${fnName}() {`,
            `  Blynk.virtualWrite(${vpin}, digitalRead(${pin}) == LOW ? 1 : 0);`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.setups_[`makerEsp32_btn_stream_${id}`] =
            `blynkIoTTimer.setInterval(${ms}L, ${fnName});`;
        return '';
    };

    // --- Maker Kit (Beginner parity) ---

    const ensureKitSerial = () => {
        // Kit HC-05 shares USB UART0 @ 9600 (Beginner convention).
        Blockly.Arduino.setups_.makerEsp32_kit_serial = 'Serial.begin(9600);';
    };

    const ensureAnalogAvgHelper = () => {
        if (Blockly.Arduino.definitions_.makerEsp32_analogAvg) {
            return;
        }
        Blockly.Arduino.definitions_.makerEsp32_analogAvg = [
            'int readAnalogAvg(int pin, int samples) {',
            '  long sum = 0;',
            '  for (int i = 0; i < samples; i++) {',
            '    sum += analogRead(pin);',
            '    delay(2);',
            '  }',
            '  return (int)(sum / samples);',
            '}',
            '',
            'int soilRawToPercent(int raw) {',
            '  const int dryRaw = 3200;',
            '  const int wetRaw = 1200;',
            '  if (raw <= 50) return -1;',
            '  int pct = map(constrain(raw, wetRaw, dryRaw), dryRaw, wetRaw, 0, 100);',
            '  if (pct < 0) pct = 0;',
            '  if (pct > 100) pct = 100;',
            '  return pct;',
            '}'
        ].join('\n');
    };

    const ensureDht11Helper = () => {
        if (Blockly.Arduino.definitions_.makerEsp32_dht11) {
            return;
        }
        Blockly.Arduino.definitions_.makerEsp32_dht11 = [
            'bool sampleDht11Once(uint8_t pin, float *temperatureC, float *humidityPct) {',
            '  uint16_t rawHumidity = 0;',
            '  uint16_t rawTemperature = 0;',
            '  uint16_t data = 0;',
            '  digitalWrite(pin, LOW);',
            '  pinMode(pin, OUTPUT);',
            '  delay(20);',
            '  pinMode(pin, INPUT_PULLUP);',
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
            '}',
            '',
            'float makerEsp32DhtTemp(uint8_t pin) {',
            '  delay(2000);',
            '  float t = 0; float h = 0;',
            '  if (!sampleDht11(pin, &t, &h)) return NAN;',
            '  return t;',
            '}',
            '',
            'float makerEsp32DhtHumidity(uint8_t pin) {',
            '  delay(2000);',
            '  float t = 0; float h = 0;',
            '  if (!sampleDht11(pin, &t, &h)) return NAN;',
            '  return h;',
            '}'
        ].join('\n');
    };

    const ensureUltraHelper = () => {
        ensurePinDefines();
        ensureKitSerial();
        if (!Blockly.Arduino.definitions_.makerEsp32_ultra) {
            // Proven HC-SR04 helper on the D5 jack: Trig IO26, Echo IO25; -1 = no/invalid echo.
            Blockly.Arduino.definitions_.makerEsp32_ultra = [
                'long getDistanceTrigEcho(int trigPin, int echoPin) {',
                '  pinMode(trigPin, OUTPUT);',
                '  pinMode(echoPin, INPUT);',
                '  digitalWrite(trigPin, LOW);',
                '  delayMicroseconds(3);',
                '  digitalWrite(trigPin, HIGH);',
                '  delayMicroseconds(10);',
                '  digitalWrite(trigPin, LOW);',
                '  long duration = pulseIn(echoPin, HIGH, 30000);',
                '  if (duration == 0) return -1;',
                '  long distanceCM = duration * 0.0343 / 2;',
                '  if (distanceCM < 2 || distanceCM > 400) return -1;',
                '  return distanceCM;',
                '}'
            ].join('\n');
        }
        Blockly.Arduino.setups_.makerEsp32_ultra = [
            'pinMode(ULTRA_TRIG_PIN, OUTPUT);',
            'digitalWrite(ULTRA_TRIG_PIN, LOW);',
            'pinMode(ULTRA_ECHO_PIN, INPUT);',
            'delay(500);'
        ].join('\n');
    };

    const ensureRfid = () => {
        ensurePinDefines();
        Blockly.Arduino.includes_.makerEsp32_spi = '#include <SPI.h>';
        Blockly.Arduino.includes_.makerEsp32_mfrc522 = '#include <MFRC522.h>';
        Blockly.Arduino.definitions_.makerEsp32_rfid =
            'MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);\nString rfidUid = "";';
        Blockly.Arduino.setups_.makerEsp32_rfid = [
            'SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);',
            'mfrc522.PCD_Init();'
        ].join('\n');
        if (!Blockly.Arduino.definitions_.makerEsp32_rfidReadFn) {
            Blockly.Arduino.definitions_.makerEsp32_rfidReadFn = [
                'String makerEsp32ReadRfid() {',
                '  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {',
                '    rfidUid = "";',
                '    for (byte i = 0; i < mfrc522.uid.size; i++) {',
                '      if (mfrc522.uid.uidByte[i] < 0x10) rfidUid += "0";',
                '      rfidUid += String(mfrc522.uid.uidByte[i], HEX);',
                '    }',
                '    mfrc522.PICC_HaltA();',
                '    return rfidUid;',
                '  }',
                '  return String("");',
                '}'
            ].join('\n');
        }
    };

    const ensureOled = () => {
        ensurePinDefines();
        Blockly.Arduino.includes_.makerEsp32_wire = '#include <Wire.h>';
        Blockly.Arduino.includes_.makerEsp32_gfx = '#include <Adafruit_GFX.h>';
        Blockly.Arduino.includes_.makerEsp32_ssd1306 = '#include <Adafruit_SSD1306.h>';
        Blockly.Arduino.definitions_.makerEsp32_oled =
            'Adafruit_SSD1306 display(128, 64, &Wire, -1);';
        Blockly.Arduino.setups_.makerEsp32_i2c = 'Wire.begin(SDA_PIN, SCL_PIN);';
        Blockly.Arduino.setups_.makerEsp32_oled = [
            'if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {',
            '  Serial.println(F("SSD1306 alloc failed"));',
            '}',
            'display.clearDisplay();',
            'display.setTextSize(1);',
            'display.setTextColor(SSD1306_WHITE);',
            'display.setCursor(0, 0);',
            'display.display();'
        ].join('\n');
        ensureKitSerial();
    };

    const ensurePulse = () => {
        ensurePinDefines();
        Blockly.Arduino.includes_.makerEsp32_wire = '#include <Wire.h>';
        Blockly.Arduino.includes_.makerEsp32_max30105 = '#include <MAX30105.h>';
        Blockly.Arduino.includes_.makerEsp32_heartRate = '#include <heartRate.h>';
        Blockly.Arduino.definitions_.makerEsp32_pulse = [
            'MAX30105 pulseSensor;',
            'long pulseLastBeat = 0;',
            'bool pulseReady = false;',
            'int heartRate = 0;',
            '',
            'int makerEsp32ReadPulse() {',
            '  if (!pulseReady) return 0;',
            '  long irValue = pulseSensor.getIR();',
            '  if (checkForBeat(irValue)) {',
            '    long delta = millis() - pulseLastBeat;',
            '    pulseLastBeat = millis();',
            '    if (delta > 0) heartRate = (int)(60000.0 / delta);',
            '  }',
            '  if (irValue < 50000) heartRate = 0;',
            '  return heartRate;',
            '}'
        ].join('\n');
        Blockly.Arduino.setups_.makerEsp32_i2c = 'Wire.begin(SDA_PIN, SCL_PIN);';
        Blockly.Arduino.setups_.makerEsp32_pulse = [
            'delay(100);',
            'Wire.begin(SDA_PIN, SCL_PIN);',
            'Wire.setClock(100000);',
            'pulseReady = pulseSensor.begin(Wire, I2C_SPEED_STANDARD, 0x57);',
            'Wire.begin(SDA_PIN, SCL_PIN);',
            'Wire.setClock(100000);',
            'if (pulseReady) {',
            '  pulseSensor.setup();',
            '  pulseSensor.setPulseAmplitudeRed(0x0A);',
            '  pulseSensor.setPulseAmplitudeGreen(0);',
            '}'
        ].join('\n');
    };

    const ensureBle = () => {
        Blockly.Arduino.includes_.makerEsp32_bleDevice = '#include <BLEDevice.h>';
        Blockly.Arduino.includes_.makerEsp32_bleServer = '#include <BLEServer.h>';
        Blockly.Arduino.includes_.makerEsp32_bleUtils = '#include <BLEUtils.h>';
        Blockly.Arduino.definitions_.makerEsp32_ble = [
            'BLEServer *pBleServer = NULL;',
            'BLECharacteristic *pBleCharacteristic = NULL;',
            'bool bleReady = false;',
            'String bleDeviceName = "TinkerBit";'
        ].join('\n');
        Blockly.Arduino.setups_.makerEsp32_ble = [
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
        ].join('\n');
    };

    const ensureRelay4 = () => {
        ensureMotorPins();
        Blockly.Arduino.setups_.makerEsp32_relay4 = [
            'digitalWrite(MOTOR_A1, HIGH);',
            'digitalWrite(MOTOR_A2, HIGH);',
            'digitalWrite(MOTOR_B1, HIGH);',
            'digitalWrite(MOTOR_B2, HIGH);'
        ].join('\n');
    };

    const ensureServo = pinExpr => {
        ensurePinDefines();
        const id = String(pinExpr).replace(/[^A-Za-z0-9_]/g, '_');
        Blockly.Arduino.includes_.makerEsp32_servo = '#include <ESP32Servo.h>';
        Blockly.Arduino.definitions_[`makerEsp32_servo_${id}`] = `Servo makerServo_${id};`;
        Blockly.Arduino.setups_[`makerEsp32_servo_${id}`] = [
            `makerServo_${id}.setPeriodHertz(50);`,
            `makerServo_${id}.attach(${pinExpr}, 500, 2400);`,
            `makerServo_${id}.write(90);`
        ].join('\n');
        return `makerServo_${id}`;
    };

    Blockly.Arduino.makerEsp32_kitButtonPressed = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        setupPin(pin, 'INPUT_PULLUP');
        return [`(digitalRead(${pin}) == LOW)`, Blockly.Arduino.ORDER_EQUALITY];
    };

    Blockly.Arduino.makerEsp32_kitReadPot = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        return [`readAnalogAvg(${pin}, 12)`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadMq2 = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        Blockly.Arduino.setups_[`makerEsp32_mq2_${pin}`] =
            `analogSetPinAttenuation(${pin}, ADC_11db);`;
        return [`readAnalogAvg(${pin}, 16)`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitPrintMq2 = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        ensureKitSerial();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        Blockly.Arduino.setups_[`makerEsp32_mq2_${pin}`] =
            `analogSetPinAttenuation(${pin}, ADC_11db);`;
        return [
            'delay(400);',
            `{`,
            `  int gasLevel = readAnalogAvg(${pin}, 16);`,
            '  Serial.print(F("Gas level="));',
            '  Serial.print(gasLevel);',
            '  Serial.println(F(" (0-4095 raw)"));',
            '}',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitReadMic = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        return [`readAnalogAvg(${pin}, 12)`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadSoil = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        Blockly.Arduino.setups_[`makerEsp32_soil_${pin}`] =
            `analogSetPinAttenuation(${pin}, ADC_11db);`;
        return [
            `({ int _sr = readAnalogAvg(${pin}, 16); int _sp = soilRawToPercent(_sr); (_sp < 0 ? 0 : _sp); })`,
            Blockly.Arduino.ORDER_ATOMIC
        ];
    };

    Blockly.Arduino.makerEsp32_kitPrintSoil = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        ensureKitSerial();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = analogPinExpr(port);
        Blockly.Arduino.setups_[`makerEsp32_soil_${pin}`] =
            `analogSetPinAttenuation(${pin}, ADC_11db);`;
        return [
            'delay(300);',
            '{',
            `  int soilRaw = readAnalogAvg(${pin}, 16);`,
            '  int soilPct = soilRawToPercent(soilRaw);',
            '  if (soilPct < 0) {',
            '    Serial.print(F("Soil FAIL raw="));',
            '    Serial.println(soilRaw);',
            '  } else {',
            '    Serial.print(F("Soil moisture="));',
            '    Serial.print(soilPct);',
            '    Serial.print(F(" % (raw="));',
            '    Serial.print(soilRaw);',
            '    Serial.println(F(")"));',
            '  }',
            '}',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitReadDhtTemp = function (block) {
        ensurePinDefines();
        ensureDht11Helper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = digitalPinExpr(port);
        setupPin(pin, 'INPUT_PULLUP');
        Blockly.Arduino.setups_.makerEsp32_dht_settle = 'delay(2000);';
        return [`makerEsp32DhtTemp(${pin})`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadDhtHumidity = function (block) {
        ensurePinDefines();
        ensureDht11Helper();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = digitalPinExpr(port);
        setupPin(pin, 'INPUT_PULLUP');
        Blockly.Arduino.setups_.makerEsp32_dht_settle = 'delay(2000);';
        return [`makerEsp32DhtHumidity(${pin})`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitPrintDht = function (block) {
        ensurePinDefines();
        ensureDht11Helper();
        ensureKitSerial();
        const port = block.getFieldValue('PORT') || 'A1';
        const pin = digitalPinExpr(port);
        setupPin(pin, 'INPUT_PULLUP');
        return [
            'delay(2000);',
            '{',
            '  float dhtT = 0; float dhtH = 0;',
            `  bool dhtOk = sampleDht11(${pin}, &dhtT, &dhtH);`,
            '  if (!dhtOk) {',
            '    Serial.println(F("DHT11 read failed"));',
            '  } else {',
            '    Serial.print(F("Temp="));',
            '    Serial.print(dhtT);',
            '    Serial.print(F(" C  Hum="));',
            '    Serial.print(dhtH);',
            '    Serial.println(F(" %"));',
            '  }',
            '}',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitReadDistance = function () {
        ensureUltraHelper();
        return ['getDistanceTrigEcho(ULTRA_TRIG_PIN, ULTRA_ECHO_PIN)', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadRfid = function () {
        ensureRfid();
        return ['makerEsp32ReadRfid()', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadPulse = function () {
        ensurePulse();
        return ['makerEsp32ReadPulse()', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitLedSet = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const state = block.getFieldValue('STATE') || 'HIGH';
        setupPin(pin, 'OUTPUT');
        return `digitalWrite(${pin}, ${state});\n`;
    };

    Blockly.Arduino.makerEsp32_kitLedBlink = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '500';
        setupPin(pin, 'OUTPUT');
        return [
            `digitalWrite(${pin}, HIGH);`,
            `delay(${ms});`,
            `digitalWrite(${pin}, LOW);`,
            `delay(${ms});`,
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitRelaySet = function (block) {
        ensurePinDefines();
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const state = block.getFieldValue('STATE') || 'HIGH';
        setupPin(pin, 'OUTPUT');
        return `digitalWrite(${pin}, ${state});\n`;
    };

    Blockly.Arduino.makerEsp32_kitServoAngle = function (block) {
        const port = block.getFieldValue('PORT') || 'D13';
        const pin = digitalPinExpr(port);
        const servo = ensureServo(pin);
        const angle = Blockly.Arduino.valueToCode(block, 'ANGLE', Blockly.Arduino.ORDER_ATOMIC) || '90';
        return `${servo}.write(${angle});\n`;
    };

    Blockly.Arduino.makerEsp32_kitRelay4Channel = function (block) {
        ensureRelay4();
        const ch = block.getFieldValue('CHANNEL') || '1';
        const on = block.getFieldValue('STATE') === 'ON';
        const pinName = ch === '2' ? 'MOTOR_A2' : ch === '3' ? 'MOTOR_B1' : ch === '4' ? 'MOTOR_B2' : 'MOTOR_A1';
        const level = on ? 'LOW' : 'HIGH';
        return `digitalWrite(${pinName}, ${level});\n`;
    };

    Blockly.Arduino.makerEsp32_kitRelay4All = function (block) {
        ensureRelay4();
        const on = block.getFieldValue('STATE') === 'ON';
        const level = on ? 'LOW' : 'HIGH';
        return [
            `digitalWrite(MOTOR_A1, ${level});`,
            `digitalWrite(MOTOR_A2, ${level});`,
            `digitalWrite(MOTOR_B1, ${level});`,
            `digitalWrite(MOTOR_B2, ${level});`,
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitOledText = function (block) {
        ensureOled();
        const text = quoteField(block.getFieldValue('TEXT') || 'Hello');
        return [
            'display.clearDisplay();',
            'display.setCursor(0, 0);',
            `display.println(F(${text}));`,
            'display.display();',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitOledNumber = function (block) {
        ensureOled();
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
        return [
            'display.clearDisplay();',
            'display.setCursor(0, 0);',
            `display.println(${value});`,
            'display.display();',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitBleAdvertise = function (block) {
        ensureBle();
        ensureKitSerial();
        const name = String(block.getFieldValue('NAME') || 'TinkerBit')
            .replace(/\\/g, '')
            .replace(/"/g, '');
        return [
            `bleDeviceName = "${name}";`,
            'if (bleReady) {',
            '  BLEDevice::getAdvertising()->stop();',
            '  BLEDevice::getAdvertising()->start();',
            `  Serial.println(F("BLE advertising: ${name}"));`,
            '}',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitBleSend = function (block) {
        ensureBle();
        ensureKitSerial();
        const text = quoteField(block.getFieldValue('TEXT') || 'Hello');
        return [
            'if (bleReady && pBleCharacteristic) {',
            `  pBleCharacteristic->setValue(${text});`,
            '  pBleCharacteristic->notify();',
            `  Serial.println(F("BLE send"));`,
            '}',
            ''
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitHc05Send = function (block) {
        ensurePinDefines();
        ensureKitSerial();
        const text = quoteField(block.getFieldValue('TEXT') || 'Hello');
        return `Serial.println(${text});\n`;
    };

    Blockly.Arduino.makerEsp32_kitHc05Available = function () {
        ensureKitSerial();
        return ['(Serial.available() > 0)', Blockly.Arduino.ORDER_RELATIONAL];
    };

    Blockly.Arduino.makerEsp32_kitHc05ReadLine = function () {
        ensureKitSerial();
        return ['Serial.readStringUntil(\'\\n\')', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    // --- Maker Kit parts added for Beginner parity (same pins and active levels as Beginner) ---

    const onOffSensor = activeLow => function (block) {
        ensurePinDefines();
        const pin = digitalPinExpr(block.getFieldValue('PORT') || 'D13');
        setupPin(pin, 'INPUT');
        return [`(digitalRead(${pin}) == ${activeLow ? 'LOW' : 'HIGH'})`, Blockly.Arduino.ORDER_EQUALITY];
    };

    Blockly.Arduino.makerEsp32_kitIrObstacle = onOffSensor(true);
    Blockly.Arduino.makerEsp32_kitReedMagnet = onOffSensor(true);
    Blockly.Arduino.makerEsp32_kitFlameSeen = onOffSensor(true);
    Blockly.Arduino.makerEsp32_kitLdrDark = onOffSensor(false);

    Blockly.Arduino.makerEsp32_kitPirMotion = function (block) {
        ensureKitSerial();
        const pin = digitalPinExpr(block.getFieldValue('PORT') || 'D13');
        Blockly.Arduino.setups_[`makerEsp32_pir_${pin}`] =
            'Serial.println(F("Motion sensor warming up - it settles after about a minute"));';
        return onOffSensor(false)(block);
    };

    Blockly.Arduino.makerEsp32_kitReadWater = function (block) {
        ensurePinDefines();
        ensureAnalogAvgHelper();
        const pin = analogPinExpr(block.getFieldValue('PORT') || 'A1');
        return [`readAnalogAvg(${pin}, 12)`, Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    const ensureMotion = () => {
        ensurePinDefines();
        ensureKitSerial();
        Blockly.Arduino.includes_.makerEsp32_wire = '#include <Wire.h>';
        if (!Blockly.Arduino.definitions_.makerEsp32_mpu) {
            // Raw Wire driver, no library: the same code Beginner Studio generates.
            Blockly.Arduino.definitions_.makerEsp32_mpu = [
                'bool mpuReady = false;',
                'uint8_t mpuAddr = 0x68;',
                'unsigned long mpuRetryMs = 0;',
                'int tiltAngle = 0;',
                'int shakeLevel = 0;',
                '',
                'bool mpuWrite(uint8_t reg, uint8_t value) {',
                '  Wire.beginTransmission(mpuAddr);',
                '  Wire.write(reg);',
                '  Wire.write(value);',
                '  return Wire.endTransmission() == 0;',
                '}',
                '',
                'bool mpuBegin() {',
                '  const uint8_t addrs[2] = {0x68, 0x69};',
                '  for (int i = 0; i < 2; i++) {',
                '    mpuAddr = addrs[i];',
                '    if (mpuWrite(0x6B, 0) && mpuWrite(0x1C, 0) && mpuWrite(0x1B, 0) && mpuWrite(0x1A, 3)) {',
                '      delay(50);',
                '      return true;',
                '    }',
                '  }',
                '  mpuAddr = 0x68;',
                '  return false;',
                '}',
                '',
                'bool mpuRead(float *v) {',
                '  if (!mpuReady) {',
                '    if (millis() - mpuRetryMs < 5000) return false;',
                '    mpuRetryMs = millis();',
                '    mpuReady = mpuBegin();',
                '    if (!mpuReady) return false;',
                '    Serial.println(F("MPU6050 found"));',
                '  }',
                '  Wire.beginTransmission(mpuAddr);',
                '  Wire.write(0x3B);',
                '  if (Wire.endTransmission(false) != 0 || Wire.requestFrom((uint8_t)mpuAddr, (uint8_t)14) != 14) {',
                '    mpuReady = false;',
                '    mpuRetryMs = millis();',
                '    Serial.println(F("MPU6050 not found - check the I2C cable"));',
                '    return false;',
                '  }',
                '  int16_t raw[7];',
                '  for (int i = 0; i < 7; i++) {',
                '    uint8_t hi = Wire.read();',
                '    uint8_t lo = Wire.read();',
                '    raw[i] = (int16_t)((hi << 8) | lo);',
                '  }',
                '  v[0] = raw[0] / 16384.0f;',
                '  v[1] = raw[1] / 16384.0f;',
                '  v[2] = raw[2] / 16384.0f;',
                '  v[3] = raw[4] / 131.0f;',
                '  v[4] = raw[5] / 131.0f;',
                '  v[5] = raw[6] / 131.0f;',
                '  return true;',
                '}',
                '',
                '// tiltAngle: -90 to 90 degrees. shakeLevel: 0 to 100, -1 if the sensor is missing.',
                'void readMotion() {',
                '  float sum[3] = {0, 0, 0};',
                '  float peak = 0;',
                '  int n = 0;',
                '  for (int i = 0; i < 10; i++) {',
                '    float v[6];',
                '    if (mpuRead(v)) {',
                '      sum[0] += v[0];',
                '      sum[1] += v[1];',
                '      sum[2] += v[2];',
                '      float g = sqrtf(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);',
                '      float spin = sqrtf(v[3] * v[3] + v[4] * v[4] + v[5] * v[5]);',
                '      float jolt = fabsf(g - 1.0f) * 100.0f + spin / 5.0f;',
                '      if (jolt > peak) peak = jolt;',
                '      n++;',
                '    } else if (!mpuReady) {',
                '      break;',
                '    }',
                '    delay(5);',
                '  }',
                '  if (!n) {',
                '    tiltAngle = 0;',
                '    shakeLevel = -1;',
                '    return;',
                '  }',
                '  tiltAngle = (int)roundf(atan2f(sum[0], sqrtf(sum[1] * sum[1] + sum[2] * sum[2])) * 57.2958f);',
                '  shakeLevel = (int)(peak > 100.0f ? 100.0f : peak);',
                '}',
                '',
                'int makerEsp32Tilt() {',
                '  readMotion();',
                '  return tiltAngle;',
                '}',
                '',
                'int makerEsp32Shake() {',
                '  readMotion();',
                '  return shakeLevel;',
                '}'
            ].join('\n');
        }
        Blockly.Arduino.setups_.makerEsp32_i2c = 'Wire.begin(SDA_PIN, SCL_PIN);';
        Blockly.Arduino.setups_.makerEsp32_mpu = [
            'mpuReady = mpuBegin();',
            'Serial.println(mpuReady ? F("MPU6050 ready") : F("MPU6050 not found - check the I2C cable"));'
        ].join('\n');
    };

    Blockly.Arduino.makerEsp32_kitReadTilt = function () {
        ensureMotion();
        return ['makerEsp32Tilt()', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    Blockly.Arduino.makerEsp32_kitReadShake = function () {
        ensureMotion();
        return ['makerEsp32Shake()', Blockly.Arduino.ORDER_FUNCTION_CALL];
    };

    /** Pump, lock and buzzer start switched off, like in Beginner Studio. */
    const offAtStartPin = block => {
        ensurePinDefines();
        const pin = digitalPinExpr(block.getFieldValue('PORT') || 'D13');
        setupPin(pin, 'OUTPUT');
        Blockly.Arduino.setups_[`makerEsp32_off_${pin}`] = `digitalWrite(${pin}, LOW);`;
        return pin;
    };

    Blockly.Arduino.makerEsp32_kitLedBrightness = function (block) {
        ensurePinDefines();
        const pin = digitalPinExpr(block.getFieldValue('PORT') || 'D13');
        const level = Blockly.Arduino.valueToCode(block, 'LEVEL', Blockly.Arduino.ORDER_NONE) || '128';
        setupPin(pin, 'OUTPUT');
        return `analogWrite(${pin}, constrain((int)(${level}), 0, 255));\n`;
    };

    Blockly.Arduino.makerEsp32_kitBuzzerBeep = function (block) {
        const pin = offAtStartPin(block);
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '200';
        return `digitalWrite(${pin}, HIGH);\ndelay(${ms});\ndigitalWrite(${pin}, LOW);\n`;
    };

    Blockly.Arduino.makerEsp32_kitBuzzerTone = function (block) {
        const pin = offAtStartPin(block);
        const freq = Blockly.Arduino.valueToCode(block, 'FREQ', Blockly.Arduino.ORDER_NONE) || '1000';
        return `tone(${pin}, constrain((int)(${freq}), 31, 20000));\n`;
    };

    Blockly.Arduino.makerEsp32_kitBuzzerStop = function (block) {
        const pin = offAtStartPin(block);
        return `noTone(${pin});\n`;
    };

    Blockly.Arduino.makerEsp32_kitPumpSet = function (block) {
        const pin = offAtStartPin(block);
        return `digitalWrite(${pin}, ${block.getFieldValue('STATE') === 'OFF' ? 'LOW' : 'HIGH'});\n`;
    };

    Blockly.Arduino.makerEsp32_kitLockSet = function (block) {
        const pin = offAtStartPin(block);
        return `digitalWrite(${pin}, ${block.getFieldValue('STATE') === 'CLOSED' ? 'LOW' : 'HIGH'});\n`;
    };

    return Blockly;
}

exports = registerGenerators;
