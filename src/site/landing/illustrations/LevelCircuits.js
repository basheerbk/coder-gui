/* eslint-disable max-len */
import {GOLD, INK, LILAC, PURPLE, svgArt} from './svg';

const LevelCircuits = svgArt(
    ['svg', {'viewBox': '0 0 300 210', 'role': 'img', 'aria-label': 'The main board with four modules plugged in: a push button, a glowing LED, an ultrasonic sensor and a buzzer', 'className': 'tb-illo'},
        ['g', {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'},
            ['rect', {x: '100', y: '56', width: '100', height: '100', rx: '10', stroke: PURPLE, strokeWidth: '2.4', fill: '#ffffff'}],
            ['circle', {cx: '110', cy: '66', r: '3', stroke: PURPLE, strokeWidth: '1.4'}],
            ['circle', {cx: '190', cy: '146', r: '3', stroke: PURPLE, strokeWidth: '1.4'}],
            ['rect', {x: '122', y: '78', width: '56', height: '56', rx: '4', stroke: INK, strokeWidth: '1.8', fill: LILAC}],
            ['polyline', {points: '128,92 128,84 136,84 136,90 144,90 144,84 152,84 152,90 160,90 160,84 168,84 168,92', stroke: PURPLE, strokeWidth: '1.4'}],
            ['text', {x: '150', y: '118', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '9px', fontWeight: '600'}, fill: PURPLE, stroke: 'none'}, 'ESP32'],
            ['rect', {x: '14', y: '78', width: '76', height: '56', rx: '7', stroke: PURPLE, strokeWidth: '2.2', fill: '#ECE3FF'}],
            ['circle', {cx: '46', cy: '104', r: '14', stroke: INK, strokeWidth: '2', fill: '#ffffff'}],
            ['circle', {cx: '46', cy: '104', r: '7', stroke: INK, strokeWidth: '2', fill: '#DCE8FF'}],
            ['text', {x: '22', y: '128', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '7px', fontWeight: '600'}, fill: INK, stroke: 'none'}, 'BUTTON'],
            ['rect', {x: '88', y: '92', width: '22', height: '28', rx: '3', stroke: INK, strokeWidth: '1.8', fill: GOLD}],
            ['path', {d: 'M94 99 V113 M99 99 V113 M104 99 V113', stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '210', y: '78', width: '76', height: '56', rx: '7', stroke: PURPLE, strokeWidth: '2.2', fill: '#ECE3FF'}],
            ['circle', {cx: '248', cy: '106', r: '18', fill: GOLD, fillOpacity: '0.3', stroke: 'none'}],
            ['path', {d: 'M240 118 v-16 a8 8 0 0 1 16 0 v16 z', fill: GOLD, stroke: INK, strokeWidth: '1.8'}],
            ['path', {d: 'M236 118 H260', stroke: INK, strokeWidth: '1.8'}],
            ['path', {d: 'M248 88 V84 M262 94 L266 90 M234 94 L230 90', stroke: INK, strokeWidth: '1.6'}],
            ['text', {x: '218', y: '128', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '7px', fontWeight: '600'}, fill: INK, stroke: 'none'}, 'LED'],
            ['rect', {x: '190', y: '92', width: '22', height: '28', rx: '3', stroke: INK, strokeWidth: '1.8', fill: GOLD}],
            ['path', {d: 'M196 99 V113 M201 99 V113 M206 99 V113', stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '100', y: '4', width: '100', height: '42', rx: '7', stroke: PURPLE, strokeWidth: '2.2', fill: '#ECE3FF'}],
            ['circle', {cx: '132', cy: '24', r: '12', stroke: INK, strokeWidth: '1.8', fill: '#D8F3E6'}],
            ['circle', {cx: '132', cy: '24', r: '5', stroke: INK, strokeWidth: '1.4'}],
            ['circle', {cx: '168', cy: '24', r: '12', stroke: INK, strokeWidth: '1.8', fill: '#D8F3E6'}],
            ['circle', {cx: '168', cy: '24', r: '5', stroke: INK, strokeWidth: '1.4'}],
            ['rect', {x: '138', y: '44', width: '24', height: '20', rx: '3', stroke: INK, strokeWidth: '1.8', fill: GOLD}],
            ['path', {d: 'M144 48 V58 M150 48 V58 M156 48 V58', stroke: INK, strokeWidth: '1.2'}],
            ['rect', {x: '100', y: '166', width: '100', height: '40', rx: '7', stroke: PURPLE, strokeWidth: '2.2', fill: '#ECE3FF'}],
            ['circle', {cx: '140', cy: '186', r: '12', stroke: INK, strokeWidth: '1.8', fill: INK}],
            ['circle', {cx: '140', cy: '186', r: '3', fill: '#ffffff', stroke: 'none'}],
            ['path', {d: 'M158 180 a8 8 0 0 1 0 12 M165 176 a14 14 0 0 1 0 20 M172 172 a20 20 0 0 1 0 28', stroke: PURPLE, strokeWidth: '2'}],
            ['rect', {x: '138', y: '148', width: '24', height: '20', rx: '3', stroke: INK, strokeWidth: '1.8', fill: GOLD}],
            ['path', {d: 'M144 152 V162 M150 152 V162 M156 152 V162', stroke: INK, strokeWidth: '1.2'}]
        ]
    ]
);

export default LevelCircuits;
