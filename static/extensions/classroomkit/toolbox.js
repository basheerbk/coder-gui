/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerToolboxs () {
    return `
<category name="%{BKY_CLASSROOMKIT_CATEGORY}" id="CLASSROOMKIT_CATEGORY" colour="#FF6B35" secondaryColour="#E2571F">
    <block type="classroomKit_led" id="classroomKit_led">
        <value name="PIN">
            <shadow type="math_whole_number">
                <field name="NUM">13</field>
            </shadow>
        </value>
        <field name="STATE">HIGH</field>
    </block>
    <block type="classroomKit_blink" id="classroomKit_blink">
        <value name="PIN">
            <shadow type="math_whole_number">
                <field name="NUM">13</field>
            </shadow>
        </value>
        <value name="TIME">
            <shadow type="math_positive_number">
                <field name="NUM">500</field>
            </shadow>
        </value>
    </block>
    <block type="classroomKit_button" id="classroomKit_button">
        <value name="PIN">
            <shadow type="math_whole_number">
                <field name="NUM">2</field>
            </shadow>
        </value>
    </block>
    <block type="classroomKit_buzzer" id="classroomKit_buzzer">
        <value name="PIN">
            <shadow type="math_whole_number">
                <field name="NUM">8</field>
            </shadow>
        </value>
        <value name="FREQ">
            <shadow type="math_whole_number">
                <field name="NUM">440</field>
            </shadow>
        </value>
        <value name="TIME">
            <shadow type="math_positive_number">
                <field name="NUM">200</field>
            </shadow>
        </value>
    </block>
</category>`;
}

exports = registerToolboxs;
