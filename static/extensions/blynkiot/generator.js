/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerGenerators (Blockly) {
    const ensureBlynkCore = () => {
        Blockly.Arduino.includes_.blynkIoT = [
            '#include <WiFi.h>',
            '#include <BlynkSimpleEsp32.h>'
        ].join('\n');
        if (!Blockly.Arduino.definitions_.blynkIoT_timer) {
            Blockly.Arduino.definitions_.blynkIoT_timer = 'BlynkTimer blynkIoTTimer;';
        }
        Blockly.Arduino.loops_.blynkIoT_run = 'Blynk.run();';
        Blockly.Arduino.loops_.blynkIoT_timer_run = 'blynkIoTTimer.run();';
    };

    const quoteField = value => {
        const text = String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `"${text}"`;
    };

    Blockly.Arduino.blynkIoT_connect = function (block) {
        ensureBlynkCore();
        const auth = quoteField(block.getFieldValue('AUTH'));
        const ssid = quoteField(block.getFieldValue('SSID'));
        const pass = quoteField(block.getFieldValue('PASS'));

        Blockly.Arduino.definitions_.blynkIoT_auth = `char blynkIoTAuth[] = ${auth};`;
        Blockly.Arduino.definitions_.blynkIoT_ssid = `char blynkIoTSsid[] = ${ssid};`;
        Blockly.Arduino.definitions_.blynkIoT_pass = `char blynkIoTPass[] = ${pass};`;
        Blockly.Arduino.setups_.blynkIoT_serial = 'Serial.begin(115200);';
        Blockly.Arduino.setups_.blynkIoT_begin =
            'Blynk.begin(blynkIoTAuth, blynkIoTSsid, blynkIoTPass);';
        return '';
    };

    Blockly.Arduino.blynkIoT_virtualWrite = function (block) {
        ensureBlynkCore();
        const pin = block.getFieldValue('PIN');
        const value = Blockly.Arduino.valueToCode(block, 'VALUE', Blockly.Arduino.ORDER_ATOMIC) || '0';
        return `Blynk.virtualWrite(${pin}, ${value});\n`;
    };

    Blockly.Arduino.blynkIoT_whenVirtualPin = function (block) {
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
        ensureBlynkCore();
        return ['Blynk.connected()', Blockly.Arduino.ORDER_ATOMIC];
    };

    return Blockly;
}

exports = registerGenerators;
