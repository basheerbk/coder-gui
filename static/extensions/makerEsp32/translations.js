/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quotes */
function getInterfaceTranslations () {
    return {
        en: {
            'makerEsp32.name': 'Maker ESP32',
            'makerEsp32.description':
                'RJ11 port blocks and Maker Blynk bridges for the Maker ESP32 board.'
        }
    };
}

function registerScratchExtensionTranslations () {
    return {};
}

function registerBlocksMessages (Blockly) {
    Object.assign(Blockly.ScratchMsgs.locales.en, {
        MAKERESP32_CAT_DIGITAL: 'Maker Digital',
        MAKERESP32_CAT_ANALOG: 'Maker Analog',
        MAKERESP32_CAT_MOTORS: 'Maker Motors',
        MAKERESP32_CAT_STEPPER: 'Maker Stepper',
        MAKERESP32_CAT_I2C: 'Maker I2C',
        MAKERESP32_CAT_BLYNK: 'Maker Blynk',
        MAKERESP32_SET_DIGITAL: 'set digital port %1 %2',
        MAKERESP32_READ_DIGITAL: 'digital port %1',
        MAKERESP32_READ_ANALOG: 'analog port %1',
        MAKERESP32_SET_MOTOR: 'motor %1 %2 speed %3',
        MAKERESP32_STOP_MOTORS: 'stop motors',
        MAKERESP32_STEPPER_MOVE: 'stepper %1 %2 steps at %3 RPM',
        MAKERESP32_INIT_I2C: 'init I2C (SDA 21, SCL 22)',
        MAKERESP32_HIGH: 'HIGH',
        MAKERESP32_LOW: 'LOW',
        MAKERESP32_FORWARD: 'forward',
        MAKERESP32_BACKWARD: 'backward',
        MAKERESP32_STOP: 'stop',
        MAKERESP32_CW: 'CW',
        MAKERESP32_CCW: 'CCW',
        MAKERESP32_MOTOR_A: 'A',
        MAKERESP32_MOTOR_B: 'B',
        MAKERESP32_PORT_D4: 'D5 jack · IO25',
        MAKERESP32_PORT_D5: 'D5 jack · IO26',
        MAKERESP32_PORT_D13: 'D13',
        MAKERESP32_PORT_3D: '3D (RFID SS)',
        MAKERESP32_PORT_SPARE1: 'A2',
        MAKERESP32_PORT_SPARE2: 'A3',
        MAKERESP32_PORT_A1: 'A1',
        MAKERESP32_PORT_A2: 'A2',
        MAKERESP32_PORT_A3: 'A3',
        MAKERESP32_PORT_A4: 'A4 (BOOT)',
        MAKERESP32_BLYNK_CONNECT_TEMPLATE_ID: 'connect Blynk template ID %1',
        MAKERESP32_BLYNK_CONNECT_TEMPLATE_NAME: 'template name %1',
        MAKERESP32_BLYNK_CONNECT_AUTH: 'auth token %1',
        MAKERESP32_BLYNK_CONNECT_WIFI_SSID: 'WiFi %1',
        MAKERESP32_BLYNK_CONNECT_WIFI_PASS: 'password %1',
        MAKERESP32_BLYNK_SEND_DIGITAL: 'send digital port %1 to %2',
        MAKERESP32_BLYNK_SEND_ANALOG: 'send analog port %1 to %2',
        MAKERESP32_BLYNK_WHEN_SET_DIGITAL: 'when %1 set digital port %2',
        MAKERESP32_BLYNK_WHEN_SET_MOTOR: 'when %1 set motor %2',
        MAKERESP32_BLYNK_STREAM_ANALOG: 'stream analog %1 to %2 every %3 ms',
        MAKERESP32_BLYNK_IS_CONNECTED: 'Blynk connected?',
        MAKERESP32_BLYNK_SERIAL_BEGIN: 'start Blynk serial log',
        MAKERESP32_BLYNK_SERIAL_PRINT: 'serial log %1',
        MAKERESP32_BLYNK_SERIAL_PRINT_VALUE: 'serial log %1 %2',
        MAKERESP32_BLYNK_SERIAL_LOG_CONNECTED: 'serial log Blynk connected?',
        MAKERESP32_BLYNK_WHEN_LOG_VIRTUAL: 'when %1 log to serial',
        MAKERESP32_BLYNK_WHEN_SET_LED: 'when %1 set LED on port %2',
        MAKERESP32_BLYNK_WHEN_SET_LED_BRIGHTNESS: 'when %1 set LED brightness on %2',
        MAKERESP32_BLYNK_SEND_BUTTON: 'send button %1 pressed to %2',
        MAKERESP32_BLYNK_WHEN_BEEP: 'when %1 beep on port %2',
        MAKERESP32_BLYNK_STREAM_BUTTON: 'stream button %1 to %2 every %3 ms'
    });
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceTranslations};
}
exports = registerScratchExtensionTranslations;
exports = registerBlocksMessages;
