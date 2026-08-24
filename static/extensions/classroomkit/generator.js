/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerGenerators (Blockly) {
    const setupPin = (pin, mode) => {
        Blockly.Arduino.setups_[`pinMode_${pin}`] = `pinMode(${pin}, ${mode});`;
    };

    Blockly.Arduino.classroomKit_led = function (block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC) || '13';
        const state = block.getFieldValue('STATE') || 'HIGH';
        setupPin(pin, 'OUTPUT');
        return `digitalWrite(${pin}, ${state});\n`;
    };

    Blockly.Arduino.classroomKit_blink = function (block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC) || '13';
        const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC) || '500';
        setupPin(pin, 'OUTPUT');
        return `digitalWrite(${pin}, HIGH);\ndelay(${time});\ndigitalWrite(${pin}, LOW);\ndelay(${time});\n`;
    };

    Blockly.Arduino.classroomKit_button = function (block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC) || '2';
        setupPin(pin, 'INPUT_PULLUP');
        return [`(digitalRead(${pin}) == LOW)`, Blockly.Arduino.ORDER_UNARY_PREFIX];
    };

    Blockly.Arduino.classroomKit_buzzer = function (block) {
        const pin = Blockly.Arduino.valueToCode(block, 'PIN', Blockly.Arduino.ORDER_ATOMIC) || '8';
        const freq = Blockly.Arduino.valueToCode(block, 'FREQ', Blockly.Arduino.ORDER_ATOMIC) || '440';
        const time = Blockly.Arduino.valueToCode(block, 'TIME', Blockly.Arduino.ORDER_ATOMIC) || '200';
        setupPin(pin, 'OUTPUT');
        return `tone(${pin}, ${freq}, ${time});\ndelay(${time});\nnoTone(${pin});\n`;
    };

    return Blockly;
}

exports = registerGenerators;
