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
                MOTOR_A1: 5, MOTOR_A2: 17, MOTOR_B1: 18, MOTOR_B2: 19,
                SDA: 21, SCL: 22,
                A1: 4, A2: 15, A3: 2, A4: 0,
                D4: 25, D5: 26, D13: 33, T3D: 32,
                SPARE1: 15, SPARE2: 2
            },
            digitalPorts: {
                D4: 'D4_PIN', D5: 'D5_PIN', D13: 'D13_PIN',
                T3D: 'T3D_PIN', '3D': 'T3D_PIN',
                A2: 'A2_PIN', A3: 'A3_PIN',
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
            `#define D4_PIN ${PINS.D4}`,
            `#define D5_PIN ${PINS.D5}`,
            `#define D13_PIN ${PINS.D13}`,
            `#define T3D_PIN ${PINS.T3D}`,
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
        return map[port] || 'D13_PIN';
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
        const port = block.getFieldValue('PORT') || 'D4';
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

    return Blockly;
}

exports = registerGenerators;
