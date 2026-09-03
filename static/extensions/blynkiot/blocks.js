/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerBlocks (Blockly) {
    const color = '#23C1E8';
    const secondaryColour = '#1A9BB8';

    const virtualPinOptions = [];
    for (let i = 0; i <= 31; i++) {
        virtualPinOptions.push([`V${i}`, `V${i}`]);
    }

    const gpioOptions = [];
    for (let i = 0; i <= 39; i++) {
        // Skip flash bus pins that must never be exposed.
        if (i >= 6 && i <= 11) continue;
        gpioOptions.push([`IO${i}`, String(i)]);
    }

    Blockly.Blocks.blynkIoT_connect = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_CONNECT_TEMPLATE_ID,
                message1: Blockly.Msg.BLYNKIOT_CONNECT_TEMPLATE_NAME,
                message2: Blockly.Msg.BLYNKIOT_CONNECT_AUTH,
                message3: Blockly.Msg.BLYNKIOT_CONNECT_WIFI_SSID,
                message4: Blockly.Msg.BLYNKIOT_CONNECT_WIFI_PASS,
                args0: [{
                    type: 'field_input',
                    name: 'TEMPLATE_ID',
                    text: 'TMPLxxxxxx'
                }],
                args1: [{
                    type: 'field_input',
                    name: 'TEMPLATE_NAME',
                    text: 'Device'
                }],
                args2: [{
                    type: 'field_input',
                    name: 'AUTH',
                    text: 'YourAuthToken'
                }],
                args3: [{
                    type: 'field_input',
                    name: 'SSID',
                    text: 'YourWiFi'
                }],
                args4: [{
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

    Blockly.Blocks.blynkIoT_virtualWriteText = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_VIRTUAL_WRITE_TEXT,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'hello'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_syncVirtual = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SYNC_VIRTUAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
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

    Blockly.Blocks.blynkIoT_wifiConnected = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_WIFI_CONNECTED,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    // --- Serial logs ---

    Blockly.Blocks.blynkIoT_serialBegin = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SERIAL_BEGIN,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_serialPrint = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SERIAL_PRINT,
                args0: [{
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'hello'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_serialPrintValue = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SERIAL_PRINT_VALUE,
                args0: [{
                    type: 'field_input',
                    name: 'LABEL',
                    text: 'value'
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

    Blockly.Blocks.blynkIoT_serialLogConnected = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SERIAL_LOG_CONNECTED,
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_whenLogVirtual = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_WHEN_LOG_VIRTUAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    // --- GPIO bridges ---

    Blockly.Blocks.blynkIoT_sendDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SEND_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'GPIO',
                    options: gpioOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_sendAnalog = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_SEND_ANALOG,
                args0: [{
                    type: 'field_dropdown',
                    name: 'GPIO',
                    options: gpioOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.blynkIoT_whenSetDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_WHEN_SET_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'GPIO',
                    options: gpioOptions
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.blynkIoT_whenSetPwm = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_WHEN_SET_PWM,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'GPIO',
                    options: gpioOptions
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.blynkIoT_streamAnalog = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.BLYNKIOT_STREAM_ANALOG,
                args0: [{
                    type: 'field_dropdown',
                    name: 'GPIO',
                    options: gpioOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PIN',
                    options: virtualPinOptions
                }, {
                    type: 'input_value',
                    name: 'MS'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    return Blockly;
}

exports = registerBlocks;
