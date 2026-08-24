/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerBlocks (Blockly) {
    const color = '#FF6B35';
    const secondaryColour = '#E2571F';

    Blockly.Blocks.classroomKit_led = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.CLASSROOMKIT_LED,
                args0: [{
                    type: 'input_value',
                    name: 'PIN'
                }, {
                    type: 'field_dropdown',
                    name: 'STATE',
                    options: [
                        [Blockly.Msg.CLASSROOMKIT_ON, 'HIGH'],
                        [Blockly.Msg.CLASSROOMKIT_OFF, 'LOW']
                    ]
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.classroomKit_blink = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.CLASSROOMKIT_BLINK,
                args0: [{
                    type: 'input_value',
                    name: 'PIN'
                }, {
                    type: 'input_value',
                    name: 'TIME'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['shape_statement']
            });
        }
    };

    Blockly.Blocks.classroomKit_button = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.CLASSROOMKIT_BUTTON,
                args0: [{
                    type: 'input_value',
                    name: 'PIN'
                }],
                colour: color,
                secondaryColour: secondaryColour,
                extensions: ['output_boolean']
            });
        }
    };

    Blockly.Blocks.classroomKit_buzzer = {
        init: function () {
            this.jsonInit({
                message0: Blockly.Msg.CLASSROOMKIT_BUZZER,
                args0: [{
                    type: 'input_value',
                    name: 'PIN'
                }, {
                    type: 'input_value',
                    name: 'FREQ'
                }, {
                    type: 'input_value',
                    name: 'TIME'
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
