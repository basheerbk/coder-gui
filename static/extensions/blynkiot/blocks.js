/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerBlocks (Blockly) {
    const color = '#23C1E8';
    const secondaryColour = '#1A9BB8';

    const virtualPinOptions = [];
    for (let i = 0; i <= 31; i++) {
        virtualPinOptions.push([`V${i}`, `V${i}`]);
    }

    Blockly.Blocks.blynkIoT_connect = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_CONNECT,
                message1: Blockly.Msg.BLYNKIOT_CONNECT_WIFI,
                args0: [{
                    type: 'field_input',
                    name: 'AUTH',
                    text: 'YourAuthToken'
                }],
                args1: [{
                    type: 'field_input',
                    name: 'SSID',
                    text: 'YourWiFi'
                }, {
                    type: 'field_input',
                    name: 'PASS',
                    text: 'YourPassword'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_virtualWrite = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_VIRTUAL_WRITE,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }, {
                    type: 'input_value',
                    name: 'VALUE'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_whenVirtualPin = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_WHEN_VIRTUAL_PIN,
                message1: '%1',
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }],
                args1: [{
                    type: 'input_statement',
                    name: 'DO'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.blynkIoT_receivedValue = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_RECEIVED_VALUE,
                args0: [{
                    type: 'field_dropdown',
                    name: 'TYPE',
                    options: [
                        [Blockly.Msg.BLYNKIOT_VALUE_INT, 'INT'],
                        [Blockly.Msg.BLYNKIOT_VALUE_FLOAT, 'FLOAT'],
                        [Blockly.Msg.BLYNKIOT_VALUE_STRING, 'STRING']
                    ]
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.blynkIoT_timerEvery = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_TIMER_EVERY,
                message1: '%1',
                args0: [{
                    type: 'input_value',
                    name: 'MS'
                }],
                args1: [{
                    type: 'input_statement',
                    name: 'DO'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_isConnected = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_IS_CONNECTED,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    return Blockly;
}

exports = registerBlocks;
