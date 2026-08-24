/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
function registerToolboxs () {
    return `
<category name="%{BKY_BLYNKIOT_CATEGORY}" id="BLYNKIOT_CATEGORY" colour="#23C1E8" secondaryColour="#1A9BB8">
    <block type="blynkIoT_connect" id="blynkIoT_connect">
        <field name="AUTH">YourAuthToken</field>
        <field name="SSID">YourWiFi</field>
        <field name="PASS">YourPassword</field>
    </block>
    <block type="blynkIoT_virtualWrite" id="blynkIoT_virtualWrite">
        <field name="PIN">V0</field>
        <value name="VALUE">
            <shadow type="math_number">
                <field name="NUM">1</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_whenVirtualPin" id="blynkIoT_whenVirtualPin">
        <field name="PIN">V0</field>
    </block>
    <block type="blynkIoT_receivedValue" id="blynkIoT_receivedValue">
        <field name="TYPE">INT</field>
    </block>
    <block type="blynkIoT_timerEvery" id="blynkIoT_timerEvery">
        <value name="MS">
            <shadow type="math_positive_number">
                <field name="NUM">1000</field>
            </shadow>
        </value>
    </block>
    <block type="blynkIoT_isConnected" id="blynkIoT_isConnected"></block>
</category>`;
}

exports = registerToolboxs;
