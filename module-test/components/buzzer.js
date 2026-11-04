import {TOP, sot23} from '../lib/parts.js';
import {smd, text} from '../lib/breakout.js';

/** Active buzzer (12 × 9.5 mm) soldered straight onto the purple RJ11 carrier, with its driver transistor. */
const W = 84;
const H = 50;
const CX = 60;
const CY = H / 2;
const R = 14.4;

const TOP_SVG = '<rect width="30" height="30" fill="#141416"/>' +
    '<circle cx="15" cy="15" r="14.2" fill="#1a1b1e"/>' +
    '<circle cx="15" cy="15" r="2.4" fill="#050505"/><circle cx="15" cy="15" r="3.2" fill="none" stroke="#2a2b2f" stroke-width="0.6"/>' +
    '<path d="M 15 4.5 V 8.5 M 13 6.5 H 17" stroke="#d9d9d9" stroke-width="0.7"/>';

export default {
    id: 'buzzer',
    name: 'Buzzer',
    category: 'output',
    defaultPort: 'D13',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'BUZZER',
        labelAt: [CX, H - 4],
        labelSize: 3.6,
        holes: [[W - 6, 6], [W - 6, H - 6]],
        silk: `<circle cx="${CX}" cy="${CY}" r="${R + 1.4}" fill="none" stroke="#f2f4f6" stroke-width="0.6"/>` +
            `<path d="M 26 ${CY} H 34 M 26 ${CY - 3} H 31 V 14 H ${CX - 8}" stroke="#6531a3" stroke-width="1.2" fill="none"/>` +
            text('+', CX - 7, CY - R - 3.2, {size: 3})
    },
    build (kit, g) {
        sot23(kit, g, {x: 34, y: CY - 1.7});
        smd(kit, g, 34, CY + 6);
        smd(kit, g, 34, CY - 9);
        [-3.8, 3.8].forEach(o => g.add(kit.box({x: CX + o - 0.4, y: CY - 0.4, w: 0.8, d: 0.8, h: 2, z: TOP, color: {color: '#cfd2d5', rough: 0.3, metal: 0.8}})));
        g.add(kit.cylinder({
            cx: CX,
            cy: CY,
            r: R,
            z0: TOP + 1,
            z1: TOP + 23.8,
            seg: 40,
            side: {color: '#141416', rough: 0.45},
            top: {map: kit.tex.svg('buzzer-top', 30, 30, TOP_SVG, {ppu: 12, base: '#141416'}), rough: 0.5}
        }));
    }
};
