import ScratchBlocks from 'openblock-blocks';

import {eventBlock} from './libraries/devices/index.jsx';

const categorySeparator = '<sep gap="36"/>';

const blockSeparator = '<sep gap="36"/>'; // At default scale, about 28px

const xmlEscape = function (unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        }
    });
};

/** Map exact category ids → Lucide-style icon filenames under /static/category-icons/ */
const CATEGORY_ICON_BY_ID = {
    MAKERESP32_CAT_DIGITAL: 'digital',
    MAKERESP32_CAT_ANALOG: 'analog',
    MAKERESP32_CAT_MOTORS: 'motors',
    MAKERESP32_CAT_STEPPER: 'stepper',
    MAKERESP32_CAT_I2C: 'i2c',
    MAKERESP32_CAT_BLYNK: 'cloud',
    BLYNKIOT_CATEGORY: 'cloud',
    CLASSROOMKIT_CATEGORY: 'kit'
};

/** Device categories are prefixed (arduino_pin, microbit_sensor, …). */
const CATEGORY_ICON_BY_SUFFIX = [
    ['_pin', 'pins'],
    ['_serial', 'serial'],
    ['_data', 'data'],
    ['_display', 'display'],
    ['_sensor', 'sensor'],
    ['_wireless', 'wireless'],
    ['_console', 'console']
];

const resolveCategoryIcon = function (categoryId) {
    if (!categoryId) return null;
    if (CATEGORY_ICON_BY_ID[categoryId]) {
        return CATEGORY_ICON_BY_ID[categoryId];
    }
    for (let i = 0; i < CATEGORY_ICON_BY_SUFFIX.length; i++) {
        const suffix = CATEGORY_ICON_BY_SUFFIX[i][0];
        const icon = CATEGORY_ICON_BY_SUFFIX[i][1];
        if (categoryId.endsWith(suffix)) {
            return icon;
        }
    }
    return 'extension';
};

/**
 * Ensure every <category> in extension/device XML has an iconURI.
 * Skips categories that already declare one.
 * @param {string} xml - Toolbox category XML fragment(s).
 * @returns {string} XML with iconURI attributes injected.
 */
const injectCategoryIcons = function (xml) {
    if (!xml || typeof xml !== 'string') return xml;
    return xml.replace(/<category\b([^>]*?)>/g, (full, attrs) => {
        if (/\biconURI\s*=/.test(attrs)) {
            return full;
        }
        const idMatch = /\bid\s*=\s*"([^"]+)"/.exec(attrs);
        const icon = resolveCategoryIcon(idMatch && idMatch[1]);
        if (!icon) {
            return full;
        }
        return `<category${attrs} iconURI="/static/category-icons/${icon}.svg">`;
    });
};

/* ----------  Tingaroo simplified categories  ---------- */

const start = function (isInitialSetup, device) {
    return `
    <category name="Start" id="events" colour="#E8A817" secondaryColour="#CC9200" iconURI="/static/category-icons/start.svg">
        <block type="event_whenflagclicked"/>
        <block type="event_whenkeypressed"/>
        ${blockSeparator}
        <block type="event_whenbroadcastreceived"/>
        <block type="event_broadcast">
            <value name="BROADCAST_INPUT">
                <shadow type="event_broadcast_menu"></shadow>
            </value>
        </block>
        <block type="event_broadcastandwait">
            <value name="BROADCAST_INPUT">
                <shadow type="event_broadcast_menu"></shadow>
            </value>
        </block>
        ${categorySeparator}
    </category>
    `;
};

const control = function (isInitialSetup) {
    return `
    <category name="Control" id="control" colour="#1E9E5E" secondaryColour="#178A4F" iconURI="/static/category-icons/control.svg">
        <block type="control_wait">
            <value name="DURATION">
                <shadow type="math_positive_number">
                    <field name="NUM">1</field>
                </shadow>
            </value>
        </block>
        ${blockSeparator}
        <block type="control_repeat">
            <value name="TIMES">
                <shadow type="math_whole_number">
                    <field name="NUM">10</field>
                </shadow>
            </value>
        </block>
        <block id="forever" type="control_forever"/>
        ${blockSeparator}
        <block type="control_if"/>
        <block type="control_if_else"/>
        <block id="wait_until" type="control_wait_until"/>
        <block id="repeat_until" type="control_repeat_until"/>
        ${blockSeparator}
        <block type="control_stop"/>
        ${categorySeparator}
    </category>
    `;
};

const sense = function (isInitialSetup) {
    return `
    <category name="Sense" id="sensing" colour="#17A2B8" secondaryColour="#128A9E" iconURI="/static/category-icons/sense.svg">
        <block type="operator_gt">
            <value name="OPERAND1">
                <shadow type="text">
                    <field name="TEXT"/>
                </shadow>
            </value>
            <value name="OPERAND2">
                <shadow type="text">
                    <field name="TEXT">50</field>
                </shadow>
            </value>
        </block>
        <block type="operator_lt">
            <value name="OPERAND1">
                <shadow type="text">
                    <field name="TEXT"/>
                </shadow>
            </value>
            <value name="OPERAND2">
                <shadow type="text">
                    <field name="TEXT">50</field>
                </shadow>
            </value>
        </block>
        <block type="operator_equals">
            <value name="OPERAND1">
                <shadow type="text">
                    <field name="TEXT"/>
                </shadow>
            </value>
            <value name="OPERAND2">
                <shadow type="text">
                    <field name="TEXT">50</field>
                </shadow>
            </value>
        </block>
        ${blockSeparator}
        <block type="operator_and"/>
        <block type="operator_or"/>
        <block type="operator_not"/>
        ${blockSeparator}
        <block id="timer" type="sensing_timer"/>
        <block type="sensing_resettimer"/>
        ${blockSeparator}
        <block type="sensing_keypressed">
            <value name="KEY_OPTION">
                <shadow type="sensing_keyoptions"/>
            </value>
        </block>
        <block type="sensing_mousedown"/>
        ${categorySeparator}
    </category>
    `;
};

const math = function (isInitialSetup) {
    return `
    <category name="Math" id="operators" colour="#0DAB76" secondaryColour="#099663" iconURI="/static/category-icons/math.svg">
        <block type="operator_add">
            <value name="NUM1">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
            <value name="NUM2">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        <block type="operator_subtract">
            <value name="NUM1">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
            <value name="NUM2">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        <block type="operator_multiply">
            <value name="NUM1">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
            <value name="NUM2">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        <block type="operator_divide">
            <value name="NUM1">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
            <value name="NUM2">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        ${blockSeparator}
        <block type="operator_random">
            <value name="FROM">
                <shadow type="math_number">
                    <field name="NUM">1</field>
                </shadow>
            </value>
            <value name="TO">
                <shadow type="math_number">
                    <field name="NUM">10</field>
                </shadow>
            </value>
        </block>
        ${blockSeparator}
        <block type="operator_mod">
            <value name="NUM1">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
            <value name="NUM2">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        <block type="operator_round">
            <value name="NUM">
                <shadow type="math_number">
                    <field name="NUM"/>
                </shadow>
            </value>
        </block>
        ${categorySeparator}
    </category>
    `;
};

const variables = function () {
    return `
    <category
        name="Variables"
        id="variables"
        colour="#7B68EE"
        secondaryColour="#6A5ACD"
        iconURI="/static/category-icons/variables.svg"
        custom="VARIABLE">
    </category>
    `;
};

/* eslint-enable no-unused-vars */

const xmlOpen = '<xml style="display: none">';
const xmlClose = '</xml>';

/**
 * Build the toolbox XML. Tingaroo uses a single device-oriented layout
 * with 5 core categories: Start, Control, Sense, Math, Variables.
 *
 * @param {!boolean} isInitialSetup - Whether the toolbox is for initial setup.
 * @param {?object} device - Full data of current selected device.
 * @param {?boolean} isStage - (ignored — device-only IDE)
 * @param {?string} targetId - The current editing target.
 * @param {?Array.<object>} categoriesXML - optional array of `{id,xml}` for extension categories.
 * @param {?boolean} isRealtimeMode - Current program mode.
 * @returns {string} - a ScratchBlocks-style XML document for the contents of the toolbox.
 */
const makeToolboxXML = function (isInitialSetup, device = null, isStage = true, targetId, categoriesXML = [],
    isRealtimeMode = true,
    costumeName = '', backdropName = '', soundName = '') {
    const gap = [categorySeparator];

    categoriesXML = categoriesXML.slice();
    const moveCategory = categoryId => {
        const index = categoriesXML.findIndex(categoryInfo => categoryInfo.id === categoryId);
        if (index >= 0) {
            const [categoryInfo] = categoriesXML.splice(index, 1);
            return categoryInfo.xml;
        }
    };

    const everything = [];

    let startXML = moveCategory('event') || start(isInitialSetup, device);

    // In upload mode with a device, inject the device-specific event block
    if (device && !isRealtimeMode && eventBlock[device.type]) {
        startXML = `
        <category name="Start" id="events" colour="#E8A817" secondaryColour="#CC9200" iconURI="/static/category-icons/start.svg">
            ${eventBlock[device.type]}
            ${categorySeparator}
        </category>
        `;
    }

    const controlXML = moveCategory('control') || control(isInitialSetup);
    const senseXML = moveCategory('sensing') || sense(isInitialSetup);
    const mathXML = moveCategory('operators') || math(isInitialSetup);
    const variablesXML = moveCategory('data') || variables(isInitialSetup);

    // Consume unused core category overrides so they don't appear at the bottom
    moveCategory('motion');
    moveCategory('looks');
    moveCategory('sound');
    moveCategory('procedures');

    everything.push(
        xmlOpen,
        startXML, gap,
        controlXML, gap,
        senseXML, gap,
        mathXML, gap,
        variablesXML
    );

    for (const extensionCategory of categoriesXML) {
        everything.push(gap, injectCategoryIcons(extensionCategory.xml));
    }

    everything.push(xmlClose);
    return everything.join('\n');
};

export default makeToolboxXML;
