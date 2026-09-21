/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerToolboxs () {
    return `
<category name="%{BKY_MAKERESP32_CAT_DIGITAL}" id="MAKERESP32_CAT_DIGITAL" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_setDigital" id="makerEsp32_setDigital">
        <field name="PORT">D13</field>
        <field name="STATE">HIGH</field>
    </block>
    <block type="makerEsp32_readDigital" id="makerEsp32_readDigital">
        <field name="PORT">D13</field>
    </block>
</category>
<category name="%{BKY_MAKERESP32_CAT_ANALOG}" id="MAKERESP32_CAT_ANALOG" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_readAnalog" id="makerEsp32_readAnalog">
        <field name="PORT">A1</field>
    </block>
</category>
<category name="%{BKY_MAKERESP32_CAT_MOTORS}" id="MAKERESP32_CAT_MOTORS" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_setMotor" id="makerEsp32_setMotor">
        <field name="MOTOR">A</field>
        <field name="DIR">FORWARD</field>
        <value name="SPEED">
            <shadow type="math_whole_number">
                <field name="NUM">200</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_stopMotors" id="makerEsp32_stopMotors"></block>
</category>
<category name="%{BKY_MAKERESP32_CAT_STEPPER}" id="MAKERESP32_CAT_STEPPER" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_stepperMove" id="makerEsp32_stepperMove">
        <field name="DIR">CW</field>
        <value name="STEPS">
            <shadow type="math_whole_number">
                <field name="NUM">200</field>
            </shadow>
        </value>
        <value name="RPM">
            <shadow type="math_whole_number">
                <field name="NUM">30</field>
            </shadow>
        </value>
    </block>
</category>
<category name="%{BKY_MAKERESP32_CAT_I2C}" id="MAKERESP32_CAT_I2C" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_initI2c" id="makerEsp32_initI2c"></block>
</category>
<category name="%{BKY_MAKERESP32_CAT_KIT_SENSORS}" id="MAKERESP32_CAT_KIT_SENSORS" colour="#E9C46A" secondaryColour="#B0892E">
    <block type="makerEsp32_kitButtonPressed" id="makerEsp32_kitButtonPressed">
        <field name="PORT">D13</field>
    </block>
    <block type="makerEsp32_kitReadPot" id="makerEsp32_kitReadPot">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadMq2" id="makerEsp32_kitReadMq2">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitPrintMq2" id="makerEsp32_kitPrintMq2">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadMic" id="makerEsp32_kitReadMic">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadSoil" id="makerEsp32_kitReadSoil">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitPrintSoil" id="makerEsp32_kitPrintSoil">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadDhtTemp" id="makerEsp32_kitReadDhtTemp">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadDhtHumidity" id="makerEsp32_kitReadDhtHumidity">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitPrintDht" id="makerEsp32_kitPrintDht">
        <field name="PORT">A1</field>
    </block>
    <block type="makerEsp32_kitReadDistance" id="makerEsp32_kitReadDistance"></block>
    <block type="makerEsp32_kitReadRfid" id="makerEsp32_kitReadRfid"></block>
    <block type="makerEsp32_kitReadPulse" id="makerEsp32_kitReadPulse"></block>
</category>
<category name="%{BKY_MAKERESP32_CAT_KIT_OUTPUTS}" id="MAKERESP32_CAT_KIT_OUTPUTS" colour="#F4A261" secondaryColour="#C97A3A">
    <block type="makerEsp32_kitLedSet" id="makerEsp32_kitLedSet">
        <field name="PORT">D13</field>
        <field name="STATE">HIGH</field>
    </block>
    <block type="makerEsp32_kitLedBlink" id="makerEsp32_kitLedBlink">
        <field name="PORT">D13</field>
        <value name="MS">
            <shadow type="math_whole_number">
                <field name="NUM">500</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_kitRelaySet" id="makerEsp32_kitRelaySet">
        <field name="PORT">D13</field>
        <field name="STATE">HIGH</field>
    </block>
    <block type="makerEsp32_kitServoAngle" id="makerEsp32_kitServoAngle">
        <field name="PORT">D13</field>
        <value name="ANGLE">
            <shadow type="math_whole_number">
                <field name="NUM">90</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_kitRelay4Channel" id="makerEsp32_kitRelay4Channel">
        <field name="CHANNEL">1</field>
        <field name="STATE">ON</field>
    </block>
    <block type="makerEsp32_kitRelay4All" id="makerEsp32_kitRelay4All">
        <field name="STATE">OFF</field>
    </block>
    <block type="makerEsp32_kitOledText" id="makerEsp32_kitOledText">
        <field name="TEXT">Hello</field>
    </block>
    <block type="makerEsp32_kitOledNumber" id="makerEsp32_kitOledNumber">
        <value name="VALUE">
            <shadow type="math_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
    </block>
</category>
<category name="%{BKY_MAKERESP32_CAT_KIT_RADIO}" id="MAKERESP32_CAT_KIT_RADIO" colour="#2A9D8F" secondaryColour="#1F7A6E">
    <block type="makerEsp32_kitBleAdvertise" id="makerEsp32_kitBleAdvertise">
        <field name="NAME">TinkerBit</field>
    </block>
    <block type="makerEsp32_kitBleSend" id="makerEsp32_kitBleSend">
        <field name="TEXT">Hello</field>
    </block>
    <block type="makerEsp32_kitHc05Send" id="makerEsp32_kitHc05Send">
        <field name="TEXT">Hello</field>
    </block>
    <block type="makerEsp32_kitHc05Available" id="makerEsp32_kitHc05Available"></block>
    <block type="makerEsp32_kitHc05ReadLine" id="makerEsp32_kitHc05ReadLine"></block>
</category>
<category name="%{BKY_MAKERESP32_CAT_BLYNK}" id="MAKERESP32_CAT_BLYNK" colour="#23C1E8" secondaryColour="#1A9BB8">
    <block type="makerEsp32_blynkConnect" id="makerEsp32_blynkConnect">
        <field name="TEMPLATE_ID">TMPLxxxxxx</field>
        <field name="TEMPLATE_NAME">Device</field>
        <field name="AUTH">YourAuthToken</field>
        <field name="SSID">YourWiFi</field>
        <field name="PASS">YourPassword</field>
    </block>
    <block type="makerEsp32_blynkSerialBegin" id="makerEsp32_blynkSerialBegin"></block>
    <block type="makerEsp32_blynkSerialPrint" id="makerEsp32_blynkSerialPrint">
        <field name="TEXT">hello</field>
    </block>
    <block type="makerEsp32_blynkSerialPrintValue" id="makerEsp32_blynkSerialPrintValue">
        <field name="LABEL">value</field>
        <value name="VALUE">
            <shadow type="math_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_blynkSerialLogConnected" id="makerEsp32_blynkSerialLogConnected"></block>
    <block type="makerEsp32_blynkWhenLogVirtual" id="makerEsp32_blynkWhenLogVirtual">
        <field name="VPIN">V0</field>
    </block>
    <block type="makerEsp32_blynkSendDigital" id="makerEsp32_blynkSendDigital">
        <field name="PORT">D13</field>
        <field name="VPIN">V0</field>
    </block>
    <block type="makerEsp32_blynkSendAnalog" id="makerEsp32_blynkSendAnalog">
        <field name="PORT">A1</field>
        <field name="VPIN">V1</field>
    </block>
    <block type="makerEsp32_blynkSendButton" id="makerEsp32_blynkSendButton">
        <field name="PORT">D13</field>
        <field name="VPIN">V4</field>
    </block>
    <block type="makerEsp32_blynkWhenSetDigital" id="makerEsp32_blynkWhenSetDigital">
        <field name="VPIN">V2</field>
        <field name="PORT">D13</field>
    </block>
    <block type="makerEsp32_blynkWhenSetLed" id="makerEsp32_blynkWhenSetLed">
        <field name="VPIN">V2</field>
        <field name="PORT">D13</field>
    </block>
    <block type="makerEsp32_blynkWhenSetLedBrightness" id="makerEsp32_blynkWhenSetLedBrightness">
        <field name="VPIN">V5</field>
        <field name="PORT">D4</field>
    </block>
    <block type="makerEsp32_blynkWhenBeep" id="makerEsp32_blynkWhenBeep">
        <field name="VPIN">V6</field>
        <field name="PORT">D5</field>
    </block>
    <block type="makerEsp32_blynkWhenSetMotor" id="makerEsp32_blynkWhenSetMotor">
        <field name="VPIN">V3</field>
        <field name="MOTOR">A</field>
    </block>
    <block type="makerEsp32_blynkStreamAnalog" id="makerEsp32_blynkStreamAnalog">
        <field name="PORT">A1</field>
        <field name="VPIN">V1</field>
        <value name="MS">
            <shadow type="math_positive_number">
                <field name="NUM">1000</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_blynkStreamButton" id="makerEsp32_blynkStreamButton">
        <field name="PORT">D13</field>
        <field name="VPIN">V4</field>
        <value name="MS">
            <shadow type="math_positive_number">
                <field name="NUM">200</field>
            </shadow>
        </value>
    </block>
    <block type="makerEsp32_blynkIsConnected" id="makerEsp32_blynkIsConnected"></block>
</category>`;
}

exports = registerToolboxs;
