/* eslint-disable max-len */
import {BODY, GOLD, GRID_BG, INK, LILAC, LINE_SOFT, PURPLE, svgArt} from './svg';

const LevelIot = svgArt(
    ['svg', {'viewBox': '0 0 300 210', 'role': 'img', 'aria-label': 'The board sends sensor readings over Wi-Fi through the cloud to a phone app showing temperature, a chart and an LED switch', 'className': 'tb-illo'},
        ['g', {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'},
            ['rect', {x: '10', y: '96', width: '112', height: '100', rx: '10', stroke: PURPLE, strokeWidth: '2.4', fill: '#ffffff'}],
            ['circle', {cx: '20', cy: '106', r: '3', stroke: PURPLE, strokeWidth: '1.4'}],
            ['circle', {cx: '112', cy: '186', r: '3', stroke: PURPLE, strokeWidth: '1.4'}],
            ['rect', {x: '34', y: '114', width: '54', height: '62', rx: '4', stroke: INK, strokeWidth: '1.8', fill: LILAC}],
            ['polyline', {points: '40,128 40,120 48,120 48,126 56,126 56,120 64,120 64,126 72,126 72,120 80,120 80,128', stroke: PURPLE, strokeWidth: '1.4'}],
            ['text', {x: '61', y: '156', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '9px', fontWeight: '600'}, fill: PURPLE, stroke: 'none'}, 'ESP32'],
            ['circle', {cx: '104', cy: '114', r: '4', fill: GOLD, stroke: INK, strokeWidth: '1.4'}],
            ['rect', {x: '48', y: '190', width: '30', height: '12', rx: '6', stroke: INK, strokeWidth: '1.6', fill: '#ffffff'}],
            ['path', {d: 'M52 80 a14 14 0 0 1 18 0 M45 72 a24 24 0 0 1 32 0 M38 64 a34 34 0 0 1 46 0', stroke: PURPLE, strokeWidth: '2.2'}],
            ['circle', {cx: '61', cy: '88', r: '3', fill: PURPLE, stroke: 'none'}],
            ['path', {d: 'M88 52 Q104 34 122 46', stroke: INK, strokeWidth: '1.8', strokeDasharray: '3 5'}],
            ['path', {d: 'M116 40 L123 46 L114 49', stroke: INK, strokeWidth: '1.8'}],
            ['path', {d: 'M130 66 h44 a14 14 0 0 0 2 -28 a20 20 0 0 0 -38 -6 a14 14 0 0 0 -8 34 z', stroke: INK, strokeWidth: '2', fill: '#ffffff'}],
            ['path', {d: 'M144 54 h16 M140 46 h24', stroke: PURPLE, strokeWidth: '1.6'}],
            ['path', {d: 'M182 50 Q198 42 208 62', stroke: INK, strokeWidth: '1.8', strokeDasharray: '3 5'}],
            ['path', {d: 'M202 58 L208 63 L210 55', stroke: INK, strokeWidth: '1.8'}],
            ['rect', {x: '210', y: '40', width: '80', height: '164', rx: '14', stroke: INK, strokeWidth: '2.2', fill: '#ffffff'}],
            ['rect', {x: '239', y: '48', width: '22', height: '5', rx: '2.5', fill: INK, stroke: 'none'}],
            ['text', {x: '220', y: '72', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '8px', fontWeight: '600'}, fill: BODY, stroke: 'none'}, 'PLANT 01'],
            ['text', {x: '220', y: '98', style: {fontFamily: '\'Space Grotesk\', sans-serif', fontSize: '22px', fontWeight: '700'}, fill: PURPLE, stroke: 'none'}, '28°C'],
            ['text', {x: '220', y: '112', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '8px'}, fill: BODY, stroke: 'none'}, '64% humid'],
            ['rect', {x: '220', y: '120', width: '60', height: '34', rx: '4', stroke: LINE_SOFT, strokeWidth: '1.4', fill: GRID_BG}],
            ['polyline', {points: '224,148 232,140 240,144 248,132 256,136 264,126 276,130', stroke: PURPLE, strokeWidth: '1.8'}],
            ['rect', {x: '220', y: '164', width: '34', height: '18', rx: '9', fill: GOLD, stroke: INK, strokeWidth: '1.6'}],
            ['circle', {cx: '245', cy: '173', r: '6.5', fill: '#ffffff', stroke: INK, strokeWidth: '1.6'}],
            ['text', {x: '260', y: '177', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '8px', fontWeight: '600'}, fill: INK, stroke: 'none'}, 'LED'],
            ['rect', {x: '238', y: '192', width: '24', height: '3', rx: '1.5', fill: INK, stroke: 'none'}]
        ]
    ]
);

export default LevelIot;
