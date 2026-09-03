/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quotes */
function getInterfaceTranslations () {
    return {
        en: {
            'blynkIoT.name': 'Blynk IoT',
            'blynkIoT.description':
                'Connect ESP32 to the Blynk app with template, WiFi, GPIO bridges, and serial logs.'
        }
    };
}

function registerScratchExtensionTranslations () {
    return {};
}

function registerBlocksMessages (Blockly) {
    Object.assign(Blockly.ScratchMsgs.locales.en, {
        BLYNKIOT_CATEGORY: 'Blynk IoT',
        BLYNKIOT_CONNECT_TEMPLATE_ID: 'connect Blynk template ID %1',
        BLYNKIOT_CONNECT_TEMPLATE_NAME: 'template name %1',
        BLYNKIOT_CONNECT_AUTH: 'auth token %1',
        BLYNKIOT_CONNECT_WIFI_SSID: 'WiFi %1',
        BLYNKIOT_CONNECT_WIFI_PASS: 'password %1',
        BLYNKIOT_VIRTUAL_WRITE: 'send %2 to virtual pin %1',
        BLYNKIOT_VIRTUAL_WRITE_TEXT: 'send text %2 to virtual pin %1',
        BLYNKIOT_SYNC_VIRTUAL: 'sync virtual pin %1',
        BLYNKIOT_WHEN_VIRTUAL_PIN: 'when virtual pin %1 receives',
        BLYNKIOT_RECEIVED_VALUE: 'received value as %1',
        BLYNKIOT_VALUE_INT: 'whole number',
        BLYNKIOT_VALUE_FLOAT: 'decimal',
        BLYNKIOT_VALUE_STRING: 'text',
        BLYNKIOT_TIMER_EVERY: 'every %1 ms',
        BLYNKIOT_IS_CONNECTED: 'Blynk connected?',
        BLYNKIOT_WIFI_CONNECTED: 'WiFi connected?',
        BLYNKIOT_SERIAL_BEGIN: 'start Blynk serial log',
        BLYNKIOT_SERIAL_PRINT: 'serial log %1',
        BLYNKIOT_SERIAL_PRINT_VALUE: 'serial log %1 %2',
        BLYNKIOT_SERIAL_LOG_CONNECTED: 'serial log Blynk connected?',
        BLYNKIOT_WHEN_LOG_VIRTUAL: 'when %1 log to serial',
        BLYNKIOT_SEND_DIGITAL: 'send digital pin %1 to %2',
        BLYNKIOT_SEND_ANALOG: 'send analog pin %1 to %2',
        BLYNKIOT_WHEN_SET_DIGITAL: 'when %1 set digital pin %2',
        BLYNKIOT_WHEN_SET_PWM: 'when %1 set PWM pin %2',
        BLYNKIOT_STREAM_ANALOG: 'stream analog pin %1 to %2 every %3 ms'
    });
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceTranslations};
}
exports = registerScratchExtensionTranslations;
exports = registerBlocksMessages;
