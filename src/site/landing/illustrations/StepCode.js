/* eslint-disable max-len */
import {BODY, GOLD, INK, LILAC, LINE_SOFT, PURPLE, svgArt} from './svg';

const StepCode = svgArt(
    ['svg', {'viewBox': '0 0 300 190', 'role': 'img', 'aria-label': 'The browser block editor with three stacked blocks: when button pressed, turn LED on, wait 1 sec, and an Upload button', 'className': 'tb-illo'},
        ['g', {strokeLinejoin: 'round'},
            ['rect', {x: '4', y: '4', width: '292', height: '182', rx: '10', fill: '#ffffff', stroke: INK, strokeWidth: '2'}],
            ['path', {d: 'M4 28 H296', stroke: INK, strokeWidth: '1.6'}],
            ['circle', {cx: '18', cy: '16', r: '3.5', fill: INK}],
            ['circle', {cx: '30', cy: '16', r: '3.5', fill: INK}],
            ['circle', {cx: '42', cy: '16', r: '3.5', fill: INK}],
            ['text', {x: '58', y: '20', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '10px'}, fill: BODY}, 'tinkerbit · blocks'],
            ['path', {d: 'M62 28 V186', stroke: LINE_SOFT, strokeWidth: '1.6'}],
            ['rect', {x: '5', y: '29', width: '56', height: '156', fill: LILAC}],
            ['rect', {x: '13', y: '40', width: '40', height: '12', rx: '3', fill: GOLD, stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '13', y: '60', width: '40', height: '12', rx: '3', fill: '#DCE8FF', stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '13', y: '80', width: '40', height: '12', rx: '3', fill: '#D8F3E6', stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '13', y: '100', width: '40', height: '12', rx: '3', fill: '#ECE3FF', stroke: INK, strokeWidth: '1.2'}],
            ['path', {d: 'M76 40 h204 v30 h-166 v6 h-18 v-6 h-20 z', fill: GOLD, stroke: INK, strokeWidth: '2'}],
            ['text', {x: '88', y: '60', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '12px', fontWeight: '600'}, fill: INK}, 'when button pressed'],
            ['path', {d: 'M92 76 h4 v6 h18 v-6 h166 v28 h-166 v6 h-18 v-6 h-4 z', fill: '#ffffff', stroke: PURPLE, strokeWidth: '2'}],
            ['text', {x: '106', y: '95', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '12px', fontWeight: '600'}, fill: INK}, 'turn LED on'],
            ['path', {d: 'M92 110 h4 v6 h18 v-6 h166 v28 h-188 z', fill: '#ffffff', stroke: PURPLE, strokeWidth: '2'}],
            ['text', {x: '106', y: '129', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '12px', fontWeight: '600'}, fill: INK}, 'wait 1 sec'],
            ['rect', {x: '190', y: '152', width: '94', height: '26', rx: '6', fill: PURPLE, stroke: INK, strokeWidth: '1.6'}],
            ['text', {x: '237', y: '169', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '11px', fontWeight: '600'}, fill: '#ffffff'}, 'Upload ▶']
        ]
    ]
);

export default StepCode;
