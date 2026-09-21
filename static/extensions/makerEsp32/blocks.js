/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerBlocks (Blockly) {
    const color = '#2A9D8F';
    const secondaryColour = '#1F7A6E';
    const blynkColor = '#23C1E8';
    const blynkSecondary = '#1A9BB8';

    const digitalPortOptions = function () {
        return [
            [Blockly.Msg.MAKERESP32_PORT_D4, 'D4'],
            [Blockly.Msg.MAKERESP32_PORT_D5, 'D5'],
            [Blockly.Msg.MAKERESP32_PORT_D13, 'D13'],
            [Blockly.Msg.MAKERESP32_PORT_3D, '3D'],
            [Blockly.Msg.MAKERESP32_PORT_A2, 'A2'],
            [Blockly.Msg.MAKERESP32_PORT_A3, 'A3']
        ];
    };

    const kitDigitalPortOptions = function () {
        return [
            [Blockly.Msg.MAKERESP32_PORT_D13, 'D13'],
            [Blockly.Msg.MAKERESP32_PORT_A1, 'A1'],
            [Blockly.Msg.MAKERESP32_PORT_A2, 'A2'],
            [Blockly.Msg.MAKERESP32_PORT_A3, 'A3'],
            [Blockly.Msg.MAKERESP32_PORT_A4, 'A4']
        ];
    };

    const analogPortOptions = function () {
        return [
            [Blockly.Msg.MAKERESP32_PORT_A1, 'A1'],
            [Blockly.Msg.MAKERESP32_PORT_A2, 'A2'],
            [Blockly.Msg.MAKERESP32_PORT_A3, 'A3'],
            [Blockly.Msg.MAKERESP32_PORT_A4, 'A4']
        ];
    };

    const kitColor = '#E9C46A';
    const kitSecondary = '#B0892E';
    const kitOutColor = '#F4A261';
    const kitOutSecondary = '#C97A3A';
    const kitRadioColor = '#2A9D8F';
    const kitRadioSecondary = '#1F7A6E';

    const virtualPinOptions = [];
    for (let i = 0; i <= 31; i++) {
        virtualPinOptions.push([`V${i}`, `V${i}`]);
    }

    Blockly.Blocks.makerEsp32_setDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_SET_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.MAKERESP32_HIGH, 'HIGH'],
                        [Blockly.Msg.MAKERESP32_LOW, 'LOW']
                    ]
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_readDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_READ_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.makerEsp32_readAnalog = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_READ_ANALOG,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_setMotor = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_SET_MOTOR,
                args0: [{
                    type: 'field_dropdown',
                    name: 'MOTOR',
                    options: [
                        [Blockly.Msg.MAKERESP32_MOTOR_A, 'A'],
                        [Blockly.Msg.MAKERESP32_MOTOR_B, 'B']
                    ]
                }, {
                    type: 'field_dropdown',
                    name: 'DIR',
                    options: [
                        [Blockly.Msg.MAKERESP32_FORWARD, 'FORWARD'],
                        [Blockly.Msg.MAKERESP32_BACKWARD, 'BACKWARD'],
                        [Blockly.Msg.MAKERESP32_STOP, 'STOP']
                    ]
                }, {
                    type: 'input_value',
                    name: 'SPEED'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_stopMotors = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_STOP_MOTORS,
                args0: [],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_stepperMove = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_STEPPER_MOVE,
                args0: [{
                    type: 'field_dropdown',
                    name: 'DIR',
                    options: [
                        [Blockly.Msg.MAKERESP32_CW, 'CW'],
                        [Blockly.Msg.MAKERESP32_CCW, 'CCW']
                    ]
                }, {
                    type: 'input_value',
                    name: 'STEPS'
                }, {
                    type: 'input_value',
                    name: 'RPM'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_initI2c = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_INIT_I2C,
                args0: [],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkConnect = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_CONNECT_TEMPLATE_ID,
                message1: Blockly.Msg.MAKERESP32_BLYNK_CONNECT_TEMPLATE_NAME,
                message2: Blockly.Msg.MAKERESP32_BLYNK_CONNECT_AUTH,
                message3: Blockly.Msg.MAKERESP32_BLYNK_CONNECT_WIFI_SSID,
                message4: Blockly.Msg.MAKERESP32_BLYNK_CONNECT_WIFI_PASS,
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
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkSendDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SEND_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkSendAnalog = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SEND_ANALOG,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenSetDigital = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_SET_DIGITAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenSetMotor = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_SET_MOTOR,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'MOTOR',
                    options: [
                        [Blockly.Msg.MAKERESP32_MOTOR_A, 'A'],
                        [Blockly.Msg.MAKERESP32_MOTOR_B, 'B']
                    ]
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkStreamAnalog = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_STREAM_ANALOG,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'input_value',
                    name: 'MS'
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkIsConnected = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_IS_CONNECTED,
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['output_boolean']
            });
        }
    };

    const pwmPortOptions = function () {
        return [
            [Blockly.Msg.MAKERESP32_PORT_D4, 'D4'],
            [Blockly.Msg.MAKERESP32_PORT_D5, 'D5']
        ];
    };

    Blockly.Blocks.makerEsp32_blynkSerialBegin = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SERIAL_BEGIN,
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkSerialPrint = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SERIAL_PRINT,
                args0: [{
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'hello'
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkSerialPrintValue = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SERIAL_PRINT_VALUE,
                args0: [{
                    type: 'field_input',
                    name: 'LABEL',
                    text: 'value'
                }, {
                    type: 'input_value',
                    name: 'VALUE'
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkSerialLogConnected = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SERIAL_LOG_CONNECTED,
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenLogVirtual = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_LOG_VIRTUAL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenSetLed = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_SET_LED,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenSetLedBrightness = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_SET_LED_BRIGHTNESS,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: pwmPortOptions()
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkSendButton = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_SEND_BUTTON,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_blynkWhenBeep = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_WHEN_BEEP,
                args0: [{
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_hat']
            });
            this.setNextStatement(false, null);
        }
    };

    Blockly.Blocks.makerEsp32_blynkStreamButton = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_BLYNK_STREAM_BUTTON,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: digitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'VPIN',
                    options: virtualPinOptions
                }, {
                    type: 'input_value',
                    name: 'MS'
                }],
                colour: blynkColor,
                secondaryColour: blynkSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    // --- Maker Kit sensors ---

    Blockly.Blocks.makerEsp32_kitButtonPressed = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_BUTTON_PRESSED,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadPot = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_POT,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadMq2 = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_MQ2,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitPrintMq2 = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_PRINT_MQ2,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadMic = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_MIC,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadSoil = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_SOIL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitPrintSoil = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_PRINT_SOIL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: analogPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadDhtTemp = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_DHT_TEMP,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadDhtHumidity = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_DHT_HUMIDITY,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitPrintDht = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_PRINT_DHT,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadDistance = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_DISTANCE,
                args0: [],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadRfid = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_RFID,
                args0: [],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_string']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitReadPulse = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_READ_PULSE,
                args0: [],
                colour: kitColor,
                secondaryColour: kitSecondary,
                extensions: ['output_number']
            });
        }
    };

    // --- Maker Kit outputs ---

    Blockly.Blocks.makerEsp32_kitLedSet = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_LED_SET,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.MAKERESP32_HIGH, 'HIGH'],
                        [Blockly.Msg.MAKERESP32_LOW, 'LOW']
                    ]
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitLedBlink = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_LED_BLINK,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }, {
                    type: 'input_value',
                    name: 'MS'
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitRelaySet = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_RELAY_SET,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }, {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.MAKERESP32_HIGH, 'HIGH'],
                        [Blockly.Msg.MAKERESP32_LOW, 'LOW']
                    ]
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitServoAngle = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_SERVO_ANGLE,
                args0: [{
                    type: 'field_dropdown',
                    name: 'PORT',
                    options: kitDigitalPortOptions()
                }, {
                    type: 'input_value',
                    name: 'ANGLE'
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitRelay4Channel = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_RELAY4_CHANNEL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'CHANNEL',
                    options: [
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4']
                    ]
                }, {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.MAKERESP32_KIT_ON, 'ON'],
                        [Blockly.Msg.MAKERESP32_KIT_OFF, 'OFF']
                    ]
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitRelay4All = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_RELAY4_ALL,
                args0: [{
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.MAKERESP32_KIT_ON, 'ON'],
                        [Blockly.Msg.MAKERESP32_KIT_OFF, 'OFF']
                    ]
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitOledText = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_OLED_TEXT,
                args0: [{
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'Hello'
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitOledNumber = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_OLED_NUMBER,
                args0: [{
                    type: 'input_value',
                    name: 'VALUE'
                }],
                colour: kitOutColor,
                secondaryColour: kitOutSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    // --- Maker Kit radio ---

    Blockly.Blocks.makerEsp32_kitBleAdvertise = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_BLE_ADVERTISE,
                args0: [{
                    type: 'field_input',
                    name: 'NAME',
                    text: 'TinkerBit'
                }],
                colour: kitRadioColor,
                secondaryColour: kitRadioSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitBleSend = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_BLE_SEND,
                args0: [{
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'Hello'
                }],
                colour: kitRadioColor,
                secondaryColour: kitRadioSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitHc05Send = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_HC05_SEND,
                args0: [{
                    type: 'field_input',
                    name: 'TEXT',
                    text: 'Hello'
                }],
                colour: kitRadioColor,
                secondaryColour: kitRadioSecondary,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitHc05Available = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_HC05_AVAILABLE,
                args0: [],
                colour: kitRadioColor,
                secondaryColour: kitRadioSecondary,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.makerEsp32_kitHc05ReadLine = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.MAKERESP32_KIT_HC05_READ_LINE,
                args0: [],
                colour: kitRadioColor,
                secondaryColour: kitRadioSecondary,
                extensions: ['output_string']
            });
        }
    };

    return Blockly;
}

exports = registerBlocks;
