/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quotes */
function getInterfaceTranslations () {
    return {
        en: {
            'classroomKit.name': 'Classroom Kit',
            'classroomKit.description': 'LED, button, and buzzer blocks for classroom boards.'
        }
    };
}

function registerScratchExtensionTranslations () {
    return {};
}

function registerBlocksMessages (Blockly) {
    Object.assign(Blockly.ScratchMsgs.locales.en, {
        CLASSROOMKIT_CATEGORY: 'Classroom Kit',
        CLASSROOMKIT_LED: 'set LED pin %1 %2',
        CLASSROOMKIT_ON: 'on',
        CLASSROOMKIT_OFF: 'off',
        CLASSROOMKIT_BLINK: 'blink LED pin %1 for %2 ms',
        CLASSROOMKIT_BUTTON: 'button pin %1 pressed?',
        CLASSROOMKIT_BUZZER: 'buzzer pin %1 play %2 Hz for %3 ms'
    });
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceTranslations};
}
exports = registerScratchExtensionTranslations;
exports = registerBlocksMessages;
