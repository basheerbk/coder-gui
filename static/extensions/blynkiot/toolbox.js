/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerToolboxs () {
    return `
<category name="%{BKY_BLYNKIOT_CATEGORY}" id="BLYNKIOT_CATEGORY" colour="#23C1E8" secondaryColour="#1A9BB8">
    <block type="blynkIoT_connect" id="blynkIoT_connect">
        <field name="TEMPLATE_ID">TMPLxxxxxx</field>
        <field name="TEMPLATE_NAME">Device</field>
        <field name="AUTH">YourAuthToken</field>
        <field name="SSID">YourWiFi</field>
        <field name="PASS">YourPassword</field>
    </block>
    <block type="blynkIoT_serialBegin" id="blynkIoT_serialBegin"></block>
    <block type="blynkIoT_serialPrint" id="blynkIoT_serialPrint">
        <field name="TEXT">hello</field>
    </block>
    <block type="blynkIoT_serialPrintValue" id="blynkIoT_serialPrintValue">
        <field name="LABEL">value</field>
        <value name="VALUE">
            <shadow type="math_number">
                <field name="NUM">0</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_serialLogConnected" id="blynkIoT_serialLogConnected"></block>
    <block type="blynkIoT_whenLogVirtual" id="blynkIoT_whenLogVirtual">
        <field name="PIN">V0</field>
    </block>
    <block type="blynkIoT_virtualWrite" id="blynkIoT_virtualWrite">
        <field name="PIN">V0</field>
        <value name="VALUE">
            <shadow type="math_number">
                <field name="NUM">1</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_virtualWriteText" id="blynkIoT_virtualWriteText">
        <field name="PIN">V0</field>
        <field name="TEXT">hello</field>
    </block>
    <block type="blynkIoT_syncVirtual" id="blynkIoT_syncVirtual">
        <field name="PIN">V0</field>
    </block>
    <block type="blynkIoT_whenVirtualPin" id="blynkIoT_whenVirtualPin">
        <field name="PIN">V0</field>
    </block>
    <block type="blynkIoT_receivedValue" id="blynkIoT_receivedValue">
        <field name="TYPE">INT</field>
    </block>
    <block type="blynkIoT_sendDigital" id="blynkIoT_sendDigital">
        <field name="GPIO">2</field>
        <field name="PIN">V0</field>
    </block>
    <block type="blynkIoT_sendAnalog" id="blynkIoT_sendAnalog">
        <field name="GPIO">34</field>
        <field name="PIN">V1</field>
    </block>
    <block type="blynkIoT_whenSetDigital" id="blynkIoT_whenSetDigital">
        <field name="PIN">V2</field>
        <field name="GPIO">2</field>
    </block>
    <block type="blynkIoT_whenSetPwm" id="blynkIoT_whenSetPwm">
        <field name="PIN">V3</field>
        <field name="GPIO">5</field>
    </block>
    <block type="blynkIoT_streamAnalog" id="blynkIoT_streamAnalog">
        <field name="GPIO">34</field>
        <field name="PIN">V1</field>
        <value name="MS">
            <shadow type="math_positive_number">
                <field name="NUM">1000</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_timerEvery" id="blynkIoT_timerEvery">
        <value name="MS">
            <shadow type="math_positive_number">
                <field name="NUM">1000</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_isConnected" id="blynkIoT_isConnected"></block>
    <block type="blynkIoT_wifiConnected" id="blynkIoT_wifiConnected"></block>
</category>`;
}

exports = registerToolboxs;
