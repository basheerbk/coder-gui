/* eslint-disable max-len */
import {GOLD, INK, LILAC, PURPLE, svgArt} from './svg';

const StepClick = svgArt(
    ['svg', {'viewBox': '0 0 300 190', 'role': 'img', 'aria-label': 'A module\'s plug sliding into a port on the side of the main board', 'className': 'tb-illo'},
        ['g', {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'},
            ['rect', {x: '170', y: '30', width: '120', height: '130', rx: '12', stroke: PURPLE, strokeWidth: '2.6', fill: '#ffffff'}],
            ['circle', {cx: '276', cy: '44', r: '4', stroke: PURPLE, strokeWidth: '1.8'}],
            ['circle', {cx: '276', cy: '146', r: '4', stroke: PURPLE, strokeWidth: '1.8'}],
            ['rect', {x: '208', y: '68', width: '58', height: '54', rx: '5', stroke: INK, strokeWidth: '2', fill: LILAC}],
            ['text', {x: '237', y: '100', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '11px', fontWeight: '600'}, fill: PURPLE, stroke: 'none'}, 'ESP32'],
            ['rect', {x: '150', y: '72', width: '44', height: '46', rx: '4', stroke: INK, strokeWidth: '2.2', fill: '#ffffff'}],
            ['rect', {x: '156', y: '82', width: '22', height: '26', rx: '2', stroke: INK, strokeWidth: '1.6', fill: LILAC}],
            ['path', {d: 'M161 86 V96 M166 86 V96 M171 86 V96', stroke: INK, strokeWidth: '1.4'}],
            ['rect', {x: '10', y: '58', width: '90', height: '74', rx: '9', stroke: PURPLE, strokeWidth: '2.6', fill: '#ECE3FF'}],
            ['circle', {cx: '44', cy: '95', r: '16', stroke: INK, strokeWidth: '2.2', fill: '#ffffff'}],
            ['circle', {cx: '44', cy: '95', r: '8', stroke: INK, strokeWidth: '2.2', fill: GOLD}],
            ['rect', {x: '96', y: '84', width: '30', height: '22', rx: '3', stroke: INK, strokeWidth: '2.2', fill: '#ffffff'}],
            ['path', {d: 'M104 90 V100 M110 90 V100 M116 90 V100', stroke: INK, strokeWidth: '1.4'}],
            ['path', {d: 'M131 95 H144', stroke: INK, strokeWidth: '2.2'}],
            ['path', {d: 'M138 89 L145 95 L138 101', stroke: INK, strokeWidth: '2.2'}],
            ['text', {x: '138', y: '66', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '12px', fontWeight: '600'}, fill: INK, stroke: 'none'}, 'click!'],
            ['path', {d: 'M126 52 L122 46 M138 50 V43 M150 52 L154 46', stroke: INK, strokeWidth: '1.8'}]
        ]
    ]
);

export default StepClick;
