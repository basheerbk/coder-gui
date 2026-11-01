import {Group} from 'three';

import {PCB_H} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {BLACK, TOP, passiveTexture} from '../lib/parts.js';

/*
 * RC522 RFID reader (the common blue 40 × 60 mm board, about 2.4 units per mm) on a small
 * purple RJ11 carrier. The module stands on its 8-pin header over the carrier, antenna end
 * reaching out east past the carrier's edge.
 *
 * The module is drawn in its own portrait frame (u across 0..MU, v down 0..MV, header at the
 * top, like the photo) and turned so the header edge faces the RJ11 socket: x = v, y = MU - u.
 */
const MU = 96;
const MV = 144;
const W = 58;
const H = 60;
const CY = H / 2;
const SPACER_H = 6;
const PITCH = 6.1;
const PIN_U = Array.from({length: 8}, (_, i) => 38.5 + (i * PITCH));
const PIN_V = 7;
const PIN_NAMES = ['3.3V', 'RST', 'GND', 'IRQ', 'MISO', 'MOSI', 'SCK', 'SDA'];
const PIN_MID = MU - ((PIN_U[0] + PIN_U[7]) / 2);
const MOD = {x: 30, y: CY - PIN_MID};

const BLUE = '#1c5d8f';
const COIL = '#3a86c4';
const SILK = '#f2f4f6';

/** Portrait (u, v) to the module's landscape frame. */
const P = (u, v) => [v, MU - u];

/** Small SMD parts in portrait coords: [ref, kind, u, v, width along u, depth along v]. */
const PARTS = [
    ['L1', 'R', 8, 12, 7, 4], ['L2', 'R', 8, 18, 7, 4], ['D1', 'R', 8, 24, 7, 4],
    ['C1', 'C', 18, 12.5, 3.6, 2], ['C2', 'C', 18, 18.5, 3.6, 2], ['C3', 'C', 18, 24.5, 3.6, 2],
    ['C4', 'C', 37, 16, 3.6, 2], ['R1', 'R', 37, 21, 3.6, 2], ['C5', 'C', 37, 26, 3.6, 2], ['R2', 'R', 37, 31, 3.6, 2],
    ['R3', 'R', 65, 16, 3.6, 2], ['C12', 'C', 65, 21, 3.6, 2], ['R4', 'R', 65, 26, 3.6, 2], ['C13', 'C', 65, 31, 3.6, 2],
    ...['C10', 'C8', 'C6', 'C7', 'C9', 'C11'].map((ref, i) => [ref, 'C', 31 + (i * 6.8), 57, 2.2, 4])
];
const CHIP = {u: 47, v: 16.5, s: 12};
const XTAL = {u: 77, v: 13, w: 13, d: 6};
const HOLES = [[6.5, 39], [MU - 6.5, 39], [6.5, MV - 7], [MU - 6.5, MV - 7]];

/** Module artwork in portrait coordinates. */
const PORTRAIT_SVG = (() => {
    let s = `<rect width="${MU}" height="${MV}" fill="${BLUE}"/>`;
    // antenna: four printed loops, leads to the tuning capacitors, the wave symbol and the name
    for (let k = 0; k < 4; k++) {
        const o = k * 1.9;
        s += `<rect x="${6 + o}" y="${48 + o}" width="${84 - (2 * o)}" height="${88 - (2 * o)}" rx="${3.5 - (k * 0.6)}" ` +
            `fill="none" stroke="${COIL}" stroke-width="0.9"/>`;
    }
    s += `<path d="M 40 48 V 34 M 56 48 V 34 M 30 61 H 66" stroke="${COIL}" stroke-width="0.8" fill="none"/>`;
    const wave = (side, r) => {
        const a = 42 * (Math.PI / 180);
        const cx = 48;
        const cy = 98;
        const dx = side * r * Math.cos(a);
        const dy = r * Math.sin(a);
        return `<path d="M ${cx + dx} ${cy - dy} A ${r} ${r} 0 0 ${side > 0 ? 1 : 0} ${cx + dx} ${cy + dy}" ` +
            `fill="none" stroke="${SILK}" stroke-width="1.3" stroke-linecap="round"/>`;
    };
    [5, 10, 15, 20].forEach(r => {
        s += wave(1, r) + wave(-1, r);
    });
    s += `<circle cx="48" cy="98" r="1.6" fill="${SILK}"/>`;
    s += `<text x="48" y="131" fill="${SILK}" font-family="Arial, Helvetica, sans-serif" font-size="8.6" ` +
        'text-anchor="middle" dominant-baseline="middle" letter-spacing="0.3">RFID-RC522</text>';
    // header pads and their names (printed upside-down, as on the board)
    PIN_U.forEach((u, i) => {
        s += `<circle cx="${u}" cy="${PIN_V}" r="2.2" fill="#d9dbdd"/><circle cx="${u}" cy="${PIN_V}" r="1.05" fill="#10202e"/>`;
        s += `<text x="${u}" y="13" fill="${SILK}" font-family="Arial Narrow, Arial, sans-serif" font-size="2.1" ` +
            `text-anchor="middle" dominant-baseline="middle" transform="rotate(180 ${u} 13)">${PIN_NAMES[i]}</text>`;
    });
    // mounting holes
    HOLES.forEach(([u, v]) => {
        s += `<circle cx="${u}" cy="${v}" r="3.6" fill="#d9dbdd"/><circle cx="${u}" cy="${v}" r="2.1" fill="#0b1a26"/>`;
    });
    // part outlines and references
    PARTS.forEach(([ref, , u, v, pw, pd]) => {
        s += `<rect x="${u - 0.6}" y="${v - 0.6}" width="${pw + 1.2}" height="${pd + 1.2}" rx="0.4" fill="none" ` +
            `stroke="${SILK}" stroke-width="0.3"/>`;
        s += `<text x="${u + (pw / 2)}" y="${v + pd + 2.2}" fill="${SILK}" font-family="Arial, sans-serif" font-size="1.7" ` +
            `text-anchor="middle" dominant-baseline="middle">${ref}</text>`;
    });
    // QFN pads around the reader chip
    for (let i = 0; i < 8; i++) {
        const t = CHIP.v + 1.5 + (i * 1.3);
        const l = CHIP.u + 1.5 + (i * 1.3);
        s += `<rect x="${CHIP.u - 1}" y="${t - 0.3}" width="1" height="0.6" fill="#cfd2d5"/>` +
            `<rect x="${CHIP.u + CHIP.s}" y="${t - 0.3}" width="1" height="0.6" fill="#cfd2d5"/>` +
            `<rect x="${l - 0.3}" y="${CHIP.v - 1}" width="0.6" height="1" fill="#cfd2d5"/>` +
            `<rect x="${l - 0.3}" y="${CHIP.v + CHIP.s}" width="0.6" height="1" fill="#cfd2d5"/>`;
    }
    return s;
})();

/** Carrier: traces from the RJ11 socket to the header and a small title. */
const CARRIER_SILK = PIN_U.map((u, i) => {
    const y = MOD.y + (MU - u);
    const jy = CY + ((i - 3.5) * 2.3);
    return `<path d="M 26 ${jy} L 29 ${jy} L 33 ${y} H ${MOD.x + PIN_V}" fill="none" stroke="#6531a3" stroke-width="1" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>';
}).join('');

/** RC522 RFID reader on its header over the RJ11 carrier. */
export default {
    id: 'rfid',
    name: 'RFID RC522',
    category: 'sensor',
    defaultPort: 'TOP-R',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'RC522',
        labelAt: [15, 55],
        labelSize: 4.2,
        holes: [[5, 5]],
        silk: CARRIER_SILK
    },
    build (kit, g) {
        // 8-pin header spacer
        g.add(kit.box({
            x: MOD.x + PIN_V - 3,
            y: MOD.y + (MU - PIN_U[7]) - (PITCH / 2),
            w: 6,
            d: PITCH * 8,
            h: SPACER_H,
            z: TOP,
            color: BLACK
        }));

        const m = new Group();
        const [mx, my] = at(MOD.x, MOD.y);
        m.position.set(mx, my, TOP + SPACER_H);
        g.add(m);

        m.add(kit.slab({
            x: 0,
            y: 0,
            w: MV,
            d: MU,
            h: PCB_H,
            r: 2,
            top: {
                map: kit.tex.svg('rc522-top', MV, MU, `<g transform="matrix(0,-1,1,0,0,${MU})">${PORTRAIT_SVG}</g>`, {ppu: 8, base: BLUE}),
                rough: 0.55
            },
            side: {color: '#123f63', rough: 0.6}
        }));

        // header pin tips with solder
        PIN_U.forEach(u => {
            const [x, y] = P(u, PIN_V);
            m.add(kit.cylinder({cx: x, cy: y, r: 1.6, z0: TOP, z1: TOP + 0.9, side: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, seg: 16}));
            m.add(kit.box({x: x - 0.7, y: y - 0.7, w: 1.4, d: 1.4, h: 2.2, z: TOP, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}, shadow: false}));
        });

        // SMD parts
        PARTS.forEach(([, kind, u, v, pw, pd]) => {
            const big = pw >= 7;
            m.add(kit.box({
                x: v,
                y: MU - u - pw,
                w: pd,
                d: pw,
                h: big ? 2.6 : (kind === 'C' ? 1.4 : 1.1),
                z: TOP,
                color: kind === 'C' ? '#8a6641' : '#121212',
                faces: {t: {map: passiveTexture(kit, kind, pd > pw), rough: 0.45}}
            }));
        });

        // MFRC522 reader chip (QFN-32)
        m.add(kit.box({
            x: CHIP.v,
            y: MU - CHIP.u - CHIP.s,
            w: CHIP.s,
            d: CHIP.s,
            h: 1.3,
            z: TOP,
            color: {color: '#18191b', rough: 0.45},
            faces: {t: {map: kit.tex.svg('rc522-chip', CHIP.s, CHIP.s, `<rect width="${CHIP.s}" height="${CHIP.s}" fill="#1a1b1d"/>` +
                '<circle cx="2" cy="2" r="0.8" fill="#0a0a0b"/>', {ppu: 10, base: '#1a1b1d'}), rough: 0.45}}
        }));

        // 27.12 MHz HC-49S crystal
        m.add(kit.slab({
            x: XTAL.v,
            y: MU - XTAL.u - XTAL.w,
            w: XTAL.d,
            d: XTAL.w,
            h: 3.6,
            z: TOP,
            r: XTAL.d / 2,
            top: {color: '#d9dbdd', rough: 0.25, metal: 0.9},
            side: {color: '#a9acaf', rough: 0.3, metal: 0.9}
        }));
    }
};
