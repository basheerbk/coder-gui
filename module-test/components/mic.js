import {Group} from 'three';

import {PCB_H} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {BLACK, TOP, passiveTexture} from '../lib/parts.js';

/*
 * INMP441 I²S MEMS microphone breakout (round black 14 mm board, about 2.4 units per mm)
 * stacked on two 3-pin headers on the purple RJ11 carrier.
 */
const W = 80;
const H = 58;

const R = 16.8;
const D = R * 2;
const MIC = {x: 54 - R, y: 26 - R};
const SPACER_H = 6;
const NOTCH = 1.8;
const PIN_DU = 6.4;
const ROWS = [{v: R - 5.9, names: ['SCK', 'WS', 'L/R']}, {v: R + 9.2, names: ['SD', 'VDD', 'GND']}];
const PINS = ROWS.reduce((all, row) => all.concat([-1, 0, 1].map((k, i) => ({u: R + (k * PIN_DU), v: row.v, name: row.names[i]}))), []);
const LID = {u: R + 2 - 5, v: R + 1.3 - 3.8, w: 10, d: 7.6};

const GOLD = '#d4b15e';

/** Round outline with the two half-round notches at top and bottom (SVG-style points). */
const OUTLINE = (() => {
    const pts = [];
    const notches = [[R, 0], [R, D]];
    for (let i = 0; i < 180; i++) {
        const a = (i / 180) * Math.PI * 2;
        const x = R + (R * Math.cos(a));
        let y = R + (R * Math.sin(a));
        notches.forEach(([nx, ny]) => {
            const dx = x - nx;
            const dy = y - ny;
            if (Math.hypot(dx, dy) < NOTCH) {
                // pull the edge point inward onto the notch circle
                y = ny + ((ny === 0 ? 1 : -1) * Math.sqrt(Math.max(0, (NOTCH * NOTCH) - (dx * dx))));
            }
        });
        pts.push([x, y]);
    }
    return pts;
})();

/** Board top: black mask, gold edge arcs and the six plated holes. */
const TOP_SVG = (() => {
    const arc = (a0, a1, r) => {
        const p = a => [R + (r * Math.cos(a * Math.PI / 180)), R + (r * Math.sin(a * Math.PI / 180))];
        const [x0, y0] = p(a0);
        const [x1, y1] = p(a1);
        return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
    };
    return `<rect width="${D}" height="${D}" fill="#141414"/>` +
        `<path d="${arc(118, 242, R - 1.7)}" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="${arc(-62, 62, R - 1.7)}" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>` +
        PINS.map(p => `<circle cx="${p.u}" cy="${p.v}" r="1.6" fill="${GOLD}"/><circle cx="${p.u}" cy="${p.v}" r="0.85" fill="#0a0a0a"/>`).join('');
})();

/** Mic lid: brushed metal can with its laser marking. */
const LID_SVG = `<rect width="${LID.w}" height="${LID.d}" fill="#cfd2d5"/>` +
    `<rect x="0.4" y="0.4" width="${LID.w - 0.8}" height="${LID.d - 0.8}" fill="none" stroke="#a9adb1" stroke-width="0.5"/>` +
    '<g fill="#6b6f74" font-family="Arial, Helvetica, sans-serif" font-size="2" font-weight="700">' +
    '<text x="1.3" y="3.2">441</text><text x="1.3" y="5.9">CYC738</text></g>';

/** Carrier: traces from the RJ11 socket under the two headers, and the title. */
const CARRIER_SILK = PINS.map((p, i) => {
    const x = MIC.x + p.u;
    const y = MIC.y + p.v;
    const jy = 26 + ((i - 2.5) * 2.2);
    return `<path d="M 26 ${jy} L 32 ${jy} L 36 ${y} H ${x}" fill="none" stroke="#6531a3" stroke-width="1.2" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>';
}).join('');

/** INMP441 MEMS microphone breakout on the RJ11 carrier. */
export default {
    id: 'mic',
    name: 'INMP441 Microphone',
    category: 'sensor',
    defaultPort: 'A4',
    spec: {
        w: W,
        h: H,
        jackY: 26,
        label: 'INMP441 I2S MIC',
        labelAt: [52, 52.5],
        labelSize: 4,
        holes: [[W - 6, 6], [6, H - 6]],
        silk: CARRIER_SILK
    },
    build (kit, g) {
        // two 3-pin header spacers
        ROWS.forEach(row => g.add(kit.box({
            x: MIC.x + R - ((PIN_DU * 3) / 2),
            y: MIC.y + row.v - 2.6,
            w: PIN_DU * 3,
            d: 5.2,
            h: SPACER_H,
            z: TOP,
            color: BLACK
        })));

        // the breakout in its own frame: (u, v) from its bounding box corner, z = 0 underneath
        const m = new Group();
        const [mx, my] = at(MIC.x, MIC.y);
        m.position.set(mx, my, TOP + SPACER_H);
        g.add(m);

        m.add(kit.slab({
            x: 0,
            y: 0,
            w: D,
            d: D,
            h: PCB_H,
            outline: OUTLINE,
            top: {map: kit.tex.svg('inmp441-top', D, D, TOP_SVG, {ppu: 14, base: '#141414'}), rough: 0.5},
            side: {color: '#0c0c0c', rough: 0.6}
        }));

        // pin tips and solder
        PINS.forEach(p => {
            m.add(kit.cylinder({cx: p.u, cy: p.v, r: 1.3, z0: TOP, z1: TOP + 0.8, side: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, seg: 16}));
            m.add(kit.box({x: p.u - 0.6, y: p.v - 0.6, w: 1.2, d: 1.2, h: 2, z: TOP, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}, shadow: false}));
        });

        // 0603 resistor and capacitor, then the INMP441 itself
        m.add(kit.box({
            x: R - 9.6,
            y: R + 1.7 - 1.9,
            w: 1.8,
            d: 3.8,
            h: 1,
            z: TOP,
            color: '#121212',
            faces: {t: {map: passiveTexture(kit, 'R', false), rough: 0.45}}
        }));
        m.add(kit.box({
            x: R - 6.6,
            y: R + 1.5 - 1.6,
            w: 2,
            d: 3.2,
            h: 1.2,
            z: TOP,
            color: '#8a6641',
            faces: {t: {map: passiveTexture(kit, 'C', false), rough: 0.45}}
        }));
        m.add(kit.box({
            x: LID.u,
            y: LID.v,
            w: LID.w,
            d: LID.d,
            h: 2.4,
            z: TOP,
            color: {color: '#b9bdc1', rough: 0.35, metal: 0.8},
            faces: {t: {map: kit.tex.svg('inmp441-lid', LID.w, LID.d, LID_SVG, {ppu: 20, base: '#cfd2d5'}), rough: 0.4, metal: 0.6}}
        }));
    }
};
