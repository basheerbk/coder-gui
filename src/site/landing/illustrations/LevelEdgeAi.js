/* eslint-disable max-len */
import {GOLD, INK, svgArt} from './svg';

const LevelEdgeAi = svgArt(
    ['svg', {'viewBox': '0 0 300 210', 'role': 'img', 'aria-label': 'A clap is picked up by the microphone module, a small neural network on the chip recognises it, and the result reads CLAP, all offline', 'className': 'tb-illo'},
        ['g', {fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'},
            ['polyline', {points: '6,44 14,44 18,32 23,58 28,22 33,64 38,34 43,52 48,40 53,48 58,44 74,44', stroke: GOLD, strokeWidth: '2.2'}],
            ['rect', {x: '8', y: '72', width: '66', height: '70', rx: '8', stroke: '#ffffff', strokeWidth: '2.2'}],
            ['circle', {cx: '41', cy: '100', r: '13', stroke: '#ffffff', strokeWidth: '2'}],
            ['g', {fill: '#ffffff', stroke: 'none'},
                ['circle', {cx: '37', cy: '96', r: '1.6'}],
                ['circle', {cx: '45', cy: '96', r: '1.6'}],
                ['circle', {cx: '37', cy: '104', r: '1.6'}],
                ['circle', {cx: '45', cy: '104', r: '1.6'}],
                ['circle', {cx: '41', cy: '100', r: '1.6'}]
            ],
            ['text', {x: '16', y: '134', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '7px', fontWeight: '600'}, fill: '#B9A6F5', stroke: 'none'}, 'MIC'],
            ['path', {d: 'M78 106 H94', stroke: '#ffffff', strokeWidth: '2'}],
            ['path', {d: 'M89 101 L95 106 L89 111', stroke: '#ffffff', strokeWidth: '2'}],
            ['rect', {x: '100', y: '44', width: '100', height: '122', rx: '8', stroke: '#ffffff', strokeWidth: '2.4'}],
            ['path', {d: 'M116 44 V36 M132 44 V36 M150 44 V36 M168 44 V36 M184 44 V36 M116 166 V174 M132 166 V174 M150 166 V174 M168 166 V174 M184 166 V174', stroke: '#ffffff', strokeWidth: '1.8'}],
            ['text', {x: '150', y: '60', textAnchor: 'middle', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '7px', fontWeight: '600', letterSpacing: '0.8px'}, fill: '#B9A6F5', stroke: 'none'}, 'ON-DEVICE MODEL'],
            ['g', {stroke: '#B9A6F5', strokeWidth: '1', opacity: '0.8'},
                ['path', {d: 'M120 86 L150 76 M120 86 L150 98 M120 86 L150 120 M120 86 L150 142 M120 110 L150 76 M120 110 L150 98 M120 110 L150 120 M120 110 L150 142 M120 134 L150 76 M120 134 L150 98 M120 134 L150 120 M120 134 L150 142'}],
                ['path', {d: 'M150 76 L180 98 M150 98 L180 98 M150 120 L180 98 M150 142 L180 98 M150 76 L180 126 M150 98 L180 126 M150 120 L180 126 M150 142 L180 126'}]
            ],
            ['g', {stroke: '#ffffff', strokeWidth: '1.6'},
                ['circle', {cx: '120', cy: '86', r: '5', fill: '#ffffff'}],
                ['circle', {cx: '120', cy: '110', r: '5', fill: '#ffffff'}],
                ['circle', {cx: '120', cy: '134', r: '5', fill: '#ffffff'}],
                ['circle', {cx: '150', cy: '76', r: '5', fill: '#B9A6F5'}],
                ['circle', {cx: '150', cy: '98', r: '5', fill: '#B9A6F5'}],
                ['circle', {cx: '150', cy: '120', r: '5', fill: '#B9A6F5'}],
                ['circle', {cx: '150', cy: '142', r: '5', fill: '#B9A6F5'}],
                ['circle', {cx: '180', cy: '98', r: '7', fill: GOLD}],
                ['circle', {cx: '180', cy: '126', r: '5', fill: INK}]
            ],
            ['path', {d: 'M206 106 H222', stroke: '#ffffff', strokeWidth: '2'}],
            ['path', {d: 'M217 101 L223 106 L217 111', stroke: '#ffffff', strokeWidth: '2'}],
            ['rect', {x: '226', y: '62', width: '68', height: '88', rx: '8', stroke: '#ffffff', strokeWidth: '2.2'}],
            ['text', {x: '234', y: '80', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '7px', fontWeight: '600', letterSpacing: '0.8px'}, fill: '#B9A6F5', stroke: 'none'}, 'HEARD'],
            ['text', {x: '234', y: '104', style: {fontFamily: '\'Space Grotesk\', sans-serif', fontSize: '17px', fontWeight: '700'}, fill: GOLD, stroke: 'none'}, 'CLAP'],
            ['rect', {x: '234', y: '114', width: '52', height: '8', rx: '4', stroke: '#ffffff', strokeWidth: '1.4'}],
            ['rect', {x: '234', y: '114', width: '46', height: '8', rx: '4', fill: GOLD, stroke: 'none'}],
            ['text', {x: '234', y: '140', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '8px', fontWeight: '600'}, fill: '#ffffff', stroke: 'none'}, '92% sure'],
            ['path', {d: 'M134 200 h26 a8 8 0 0 0 1 -16 a11 11 0 0 0 -21 -3 a8 8 0 0 0 -6 19 z', stroke: '#B9A6F5', strokeWidth: '1.6'}],
            ['path', {d: 'M132 204 L164 180', stroke: GOLD, strokeWidth: '2'}],
            ['text', {x: '172', y: '198', style: {fontFamily: '\'JetBrains Mono\', monospace', fontSize: '8px', fontWeight: '600', letterSpacing: '0.8px'}, fill: '#B9A6F5', stroke: 'none'}, 'NO CLOUD']
        ]
    ]
);

export default LevelEdgeAi;
