/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quotes */
function getInterfaceTranslations () {
    return {
        en: {
            'blynkIoT.name': 'Blynk IoT',
            'blynkIoT.description':
                'Connect ESP32 to the Blynk app with virtual pins for IoT learning.'
        }
    };
}

function registerScratchExtensionTranslations () {
    return {};
}

function registerBlocksMessages (Blockly) {
    Object.assign(Blockly.ScratchMsgs.locales.en, {
        BLYNKIOT_CATEGORY: 'Blynk IoT',
        BLYNKIOT_CONNECT: 'connect Blynk token %1',
        BLYNKIOT_CONNECT_WIFI: 'WiFi %1 password %2',
        BLYNKIOT_VIRTUAL_WRITE: 'send %2 to virtual pin %1',
        BLYNKIOT_WHEN_VIRTUAL_PIN: 'when virtual pin %1 receives',
        BLYNKIOT_RECEIVED_VALUE: 'received value as %1',
        BLYNKIOT_VALUE_INT: 'whole number',
        BLYNKIOT_VALUE_FLOAT: 'decimal',
        BLYNKIOT_VALUE_STRING: 'text',
        BLYNKIOT_TIMER_EVERY: 'every %1 ms',
        BLYNKIOT_IS_CONNECTED: 'Blynk connected?'
    });
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceTranslations};
}
exports = registerScratchExtensionTranslations;
exports = registerBlocksMessages;
