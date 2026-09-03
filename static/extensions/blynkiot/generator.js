/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerGenerators (Blockly) {
    const quoteField = value => {
        const text = String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `"${text}"`;
    };

    const ensureBlynkCore = () => {
        if (!Blockly.Arduino.definitions_.blynkIoT_timer) {
            Blockly.Arduino.definitions_.blynkIoT_timer = 'BlynkTimer blynkIoTTimer;';
        }
        Blockly.Arduino.loops_.blynkIoT_run = 'Blynk.run();';
        Blockly.Arduino.loops_.blynkIoT_timer_run = 'blynkIoTTimer.run();';
    };

    const ensureBlynkIncludes = () => {
        const existing = Blockly.Arduino.includes_.blynkIoT || '';
        if (existing.indexOf('#include <BlynkSimpleEsp32.h>') === -1) {
            Blockly.Arduino.includes_.blynkIoT = [
                existing,
                '#include <WiFi.h>',
                '#include <BlynkSimpleEsp32.h>'
            ].filter(Boolean).join('\n');
        }
    };

    const ensureSerial = () => {
        Blockly.Arduino.setups_.blynkIoT_serial = 'Serial.begin(115200);';
    };

    const setupPin = (pin, mode) => {
        Blockly.Arduino.setups_[`pinMode_${pin}`] = `pinMode(${pin}, ${mode});`;
    };

    Blockly.Arduino.blynkIoT_connect = function (block) {
        const templateId = quoteField(block.getFieldValue('TEMPLATE_ID') || 'TMPLxxxxxx');
        const templateName = quoteField(block.getFieldValue('TEMPLATE_NAME') || 'Device');
        const auth = quoteField(block.getFieldValue('AUTH') || 'YourAuthToken');
        const ssid = quoteField(block.getFieldValue('SSID') || 'YourWiFi');
        const pass = quoteField(block.getFieldValue('PASS') || 'YourPassword');

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
        ensureSerial();
        Blockly.Arduino.setups_.blynkIoT_begin =
            'Blynk.begin(BLYNK_AUTH_TOKEN, blynkIoTSsid, blynkIoTPass);';
        return '';
    };

    Blockly.Arduino.blynkIoT_virtualWrite = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN');
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
        return `Blynk.virtualWrite(${pin}, ${value});\n`;
    };

    Blockly.Arduino.blynkIoT_virtualWriteText = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN') || 'V0';
        const text = quoteField(block.getFieldValue('TEXT') || '');
        return `Blynk.virtualWrite(${pin}, ${text});\n`;
    };

    Blockly.Arduino.blynkIoT_syncVirtual = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN') || 'V0';
        return `Blynk.syncVirtual(${pin});\n`;
    };

    Blockly.Arduino.blynkIoT_whenVirtualPin = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN');
        let branch = Blockly.Arduino.statementToCode(block, 'DO');
        if (branch) {
            branch = branch.slice(2);
        }
        const code = `BLYNK_WRITE(${pin}) {\n${branch}}\n`;
        Blockly.Arduino.customFunctions_[`blynkIoT_write_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.blynkIoT_receivedValue = function (block) {
        const type = block.getFieldValue('TYPE');
        const readers = {
            INT: 'param.asInt()',
            FLOAT: 'param.asFloat()',
            STRING: 'param.asString()'
        };
        return [readers[type] || readers.INT, Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.blynkIoT_timerEvery = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '1000';
        let branch = Blockly.Arduino.statementToCode(block, 'DO');
        if (branch) {
            branch = branch.slice(2);
        }
        const id = block.id.replace(/[^A-Za-z0-9_]/g, '_');
        const fnName = `blynkIoTTimer_${id}`;
        Blockly.Arduino.customFunctions_[fnName] = `void ${fnName}() {\n${branch}}\n`;
        Blockly.Arduino.setups_[`blynkIoT_timer_${id}`] =
            `blynkIoTTimer.setInterval(${ms}L, ${fnName});`;
        return '';
    };

    Blockly.Arduino.blynkIoT_isConnected = function () {
        ensureBlynkIncludes();
        ensureBlynkCore();
        return ['Blynk.connected()', Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.blynkIoT_wifiConnected = function () {
        ensureBlynkIncludes();
        return ['(WiFi.status() == WL_CONNECTED)', Blockly.Arduino.ORDER_ATOMIC];
    };

    Blockly.Arduino.blynkIoT_serialBegin = function () {
        ensureSerial();
        return '';
    };

    Blockly.Arduino.blynkIoT_serialPrint = function (block) {
        ensureSerial();
        const text = quoteField(block.getFieldValue('TEXT') || '');
        return `Serial.println(${text});\n`;
    };

    Blockly.Arduino.blynkIoT_serialPrintValue = function (block) {
        ensureSerial();
        const label = quoteField(block.getFieldValue('LABEL') || 'value');
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
        return `Serial.print(${label});\nSerial.print(": ");\nSerial.println(${value});\n`;
    };

    Blockly.Arduino.blynkIoT_serialLogConnected = function () {
        ensureSerial();
        ensureBlynkIncludes();
        ensureBlynkCore();
        return 'Serial.println(Blynk.connected() ? "Blynk: connected" : "Blynk: disconnected");\n';
    };

    Blockly.Arduino.blynkIoT_whenLogVirtual = function (block) {
        ensureSerial();
        ensureBlynkIncludes();
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN') || 'V0';
        const code = [
            `BLYNK_WRITE(${pin}) {`,
            `  Serial.print("${pin}=");`,
            '  Serial.println(param.asInt());',
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`blynkIoT_log_${pin}`] = code;
        return null;
    };

    Blockly.Arduino.blynkIoT_sendDigital = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const gpio = block.getFieldValue('GPIO') || '2';
        const pin = block.getFieldValue('PIN') || 'V0';
        setupPin(gpio, 'INPUT');
        return `Blynk.virtualWrite(${pin}, digitalRead(${gpio}));\n`;
    };

    Blockly.Arduino.blynkIoT_sendAnalog = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const gpio = block.getFieldValue('GPIO') || '34';
        const pin = block.getFieldValue('PIN') || 'V0';
        return `Blynk.virtualWrite(${pin}, analogRead(${gpio}));\n`;
    };

    Blockly.Arduino.blynkIoT_whenSetDigital = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const gpio = block.getFieldValue('GPIO') || '2';
        const pin = block.getFieldValue('PIN') || 'V0';
        setupPin(gpio, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${pin}) {`,
            `  digitalWrite(${gpio}, param.asInt() ? HIGH : LOW);`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`blynkIoT_setdig_${pin}_${gpio}`] = code;
        return null;
    };

    Blockly.Arduino.blynkIoT_whenSetPwm = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const gpio = block.getFieldValue('GPIO') || '2';
        const pin = block.getFieldValue('PIN') || 'V0';
        setupPin(gpio, 'OUTPUT');
        const code = [
            `BLYNK_WRITE(${pin}) {`,
            `  analogWrite(${gpio}, constrain(param.asInt(), 0, 255));`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.customFunctions_[`blynkIoT_setpwm_${pin}_${gpio}`] = code;
        return null;
    };

    Blockly.Arduino.blynkIoT_streamAnalog = function (block) {
        ensureBlynkIncludes();
        ensureBlynkCore();
        const gpio = block.getFieldValue('GPIO') || '34';
        const pin = block.getFieldValue('PIN') || 'V0';
        const ms = Blockly.Arduino.valueToCode(block, 'MS', Blockly.Arduino.ORDER_ATOMIC) || '1000';
        const id = block.id.replace(/[^A-Za-z0-9_]/g, '_');
        const fnName = `blynkIoTStream_${id}`;
        Blockly.Arduino.customFunctions_[fnName] = [
            `void ${fnName}() {`,
            `  Blynk.virtualWrite(${pin}, analogRead(${gpio}));`,
            '}\n'
        ].join('\n');
        Blockly.Arduino.setups_[`blynkIoT_stream_${id}`] =
            `blynkIoTTimer.setInterval(${ms}L, ${fnName});`;
        return '';
    };

    return Blockly;
}

exports = registerGenerators;
