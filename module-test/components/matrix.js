import {TOP, glowDecal} from '../lib/parts.js';
import {text} from '../lib/breakout.js';

/*
 * NeoPixel matrix 8 × 8 on its own purple RJ11 carrier: 64 WS2812B (5050) LEDs soldered straight
 * onto the board in a grid, each with its 100 nF capacitor, the data line snaking row by row from
 * the socket. Shown with a lit heart.
 */
const P = 22;
const N = 8;
const GX = 46;
const GY = 12;
const W = GX + ((N - 1) * P) + 20;
const H = GY + ((N - 1) * P) + 22;
const CY = H / 2;
const HEART = [
    '.##..##.',
    '########',
    '########',
    '########',
    '.######.',
    '..####..',
    '...##...',
    '........'
];
const ON = '#ff3d5a';

const cellX = c => GX + (c * P);
const cellY = r => GY + (r * P);

/** Lit / unlit 5050 tops. */
const LIT = '<rect width="12" height="12" fill="#f1f1ee"/>' +
    `<defs><radialGradient id="h"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="${ON}"/>` +
    `<stop offset="1" stop-color="${ON}" stop-opacity="0.35"/></radialGradient></defs>` +
    '<circle cx="6" cy="6" r="4.7" fill="#dfe6ee"/><circle cx="6" cy="6" r="4.7" fill="url(#h)"/>' +
    '<path d="M 0 0 L 1.6 0 L 0 1.6 Z" fill="#9aa0a5"/>';
const OFF = '<rect width="12" height="12" fill="#f1f1ee"/>' +
    '<circle cx="6" cy="6" r="4.7" fill="#e6ebf0" stroke="#cfd6dc" stroke-width="0.3"/>' +
    '<rect x="4.2" y="4.6" width="1.1" height="1.1" fill="#d9a3a3"/><rect x="5.6" y="4.6" width="1.1" height="1.1" fill="#a3d9ad"/>' +
    '<rect x="7" y="4.6" width="1.1" height="1.1" fill="#a3b6d9"/><rect x="5" y="6.6" width="2.2" height="1.6" fill="#8a8a8a"/>' +
    '<path d="M 0 0 L 1.6 0 L 0 1.6 Z" fill="#9aa0a5"/>';

const SILK = (() => {
    let s = '';
    // serpentine data path: left to right on even rows, right to left on odd rows
    let d = `M 26 ${CY} H 32 V ${cellY(0)} H ${cellX(0) - 6}`;
    for (let r = 0; r < N; r++) {
        const y = cellY(r);
        const [a, b] = r % 2 ? [cellX(N - 1), cellX(0)] : [cellX(0), cellX(N - 1)];
        d += ` M ${a} ${y} H ${b}`;
        if (r < N - 1) {
            const x = r % 2 ? b - 9 : b + 9;
            d += ` M ${b} ${y} H ${x} V ${cellY(r + 1)} H ${b}`;
        }
    }
    s += `<path d="${d}" stroke="#6531a3" stroke-width="0.9" fill="none"/>`;
    // 5V / GND rails down the sides
    s += `<path d="M 26 ${CY - 3} H 36 V ${H - 6} M 26 ${CY + 3} H 38 V 4 H ${W - 8}" stroke="#6531a3" stroke-width="1.6" fill="none"/>`;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const x = cellX(c);
            const y = cellY(r);
            s += `<rect x="${x - 7.6}" y="${y - 7.6}" width="15.2" height="15.2" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>`;
        }
    }
    s += text('DIN', 31, CY + 7, {size: 2.2});
    return s;
})();

export default {
    id: 'matrix',
    name: 'NeoPixel Matrix 8×8',
    category: 'output',
    defaultPort: 'N01',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'NEOPIXEL 8x8',
        labelAt: [GX + (((N - 1) * P) / 2), H - 4.6],
        labelSize: 3.6,
        holes: [[6, 6], [6, H - 6], [W - 6, 6], [W - 6, H - 6]],
        silk: SILK
    },
    build (kit, g) {
        const lit = kit.basic({map: kit.tex.svg('matrix-lit', 12, 12, LIT, {ppu: 12, base: '#f1f1ee'})});
        const off = {map: kit.tex.svg('matrix-off', 12, 12, OFF, {ppu: 12, base: '#f1f1ee'}), rough: 0.35};
        HEART.forEach((row, r) => row.split('').forEach((ch, c) => {
            const x = cellX(c);
            const y = cellY(r);
            const on = ch === '#';
            g.add(kit.box({x: x - 6, y: y - 6, w: 12, d: 12, h: 3.6, z: TOP, color: {color: '#f1f1ee', rough: 0.4}, faces: {t: on ? lit : off}}));
            g.add(kit.box({x: x + 6.6, y: y - 7.4, w: 2.2, d: 4.2, h: 1.2, z: TOP, color: '#8a6641'}));
            if (on) {
                g.add(glowDecal(kit, {cx: x, cy: y, size: 30, z: TOP + 3.8, color: ON, opacity: 0.55}));
            }
        }));
    }
};
