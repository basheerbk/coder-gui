import {TOP, glowDecal} from '../lib/parts.js';
import {smd, text} from '../lib/breakout.js';

/*
 * NeoPixel bar — ten WS2812B (5050) NeoPixels soldered straight onto a long purple RJ11 carrier,
 * each with its 100 nF capacitor, the data line chained DIN → DOUT from the socket through all ten.
 * Shown lit in a rainbow.
 */
const PITCH = 26;
const N = 10;
const X0 = 44;
const W = X0 + ((N - 1) * PITCH) + 18;
const H = 44;
const CY = 19;
const RAINBOW = ['#ff3b3b', '#ff8a2a', '#ffd23a', '#9cff3a', '#2aff7a', '#2affe0', '#2aa8ff', '#4a5bff', '#a24aff', '#ff4ad6'];

/** Lit 5050 top in a given colour: white body, glowing window with the three dies and driver chip. */
const pixelSvg = (c, i) => '<rect width="12" height="12" fill="#f1f1ee"/>' +
    `<defs><radialGradient id="p${i}"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="${c}"/>` +
    `<stop offset="1" stop-color="${c}" stop-opacity="0.35"/></radialGradient></defs>` +
    `<circle cx="6" cy="6" r="4.7" fill="#dfe6ee"/><circle cx="6" cy="6" r="4.7" fill="url(#p${i})"/>` +
    '<rect x="4.2" y="4.6" width="1.1" height="1.1" fill="#ff4040"/><rect x="5.6" y="4.6" width="1.1" height="1.1" fill="#40ff60"/>' +
    '<rect x="7" y="4.6" width="1.1" height="1.1" fill="#4080ff"/><rect x="5" y="6.6" width="2.2" height="1.6" fill="#555"/>' +
    '<path d="M 0 0 L 1.6 0 L 0 1.6 Z" fill="#9aa0a5"/>';

const SILK = (() => {
    let s = '';
    // 5V and GND rails along the top and bottom, the data line hopping from pixel to pixel
    s += `<path d="M 26 ${CY - 3} H 32 V 6 H ${W - 10}" stroke="#6531a3" stroke-width="1.6" fill="none"/>`;
    s += `<path d="M 26 ${CY + 3} H 32 V 32 H ${W - 10}" stroke="#6531a3" stroke-width="1.6" fill="none"/>`;
    s += `<path d="M 26 ${CY} H ${X0 - 6}" stroke="#6531a3" stroke-width="1" fill="none"/>`;
    for (let i = 0; i < N; i++) {
        const x = X0 + (i * PITCH);
        s += `<rect x="${x - 8}" y="${CY - 8}" width="16" height="16" fill="none" stroke="#f2f4f6" stroke-width="0.45"/>`;
        s += `<path d="M ${x - 8} ${CY - 5.6} L ${x - 5.6} ${CY - 8}" stroke="#f2f4f6" stroke-width="0.45"/>`;
        s += `<path d="M ${x} ${CY - 6} V 6 M ${x} ${CY + 6} V 32" stroke="#6531a3" stroke-width="0.8" fill="none"/>`;
        if (i < N - 1) {
            s += `<path d="M ${x + 6} ${CY} H ${x + PITCH - 6}" stroke="#6531a3" stroke-width="1" fill="none"/>`;
        }
        s += text(String(i + 1), x, CY + 12.4, {size: 2.2});
    }
    s += '<path d="M 30 25.2 H 36 M 34 23.8 L 36 25.2 L 34 26.6" fill="none" stroke="#f2f4f6" stroke-width="0.5"/>';
    s += text('DIN', 33, 28.6, {size: 2}) + text('5V', 36.4, 4, {size: 2}) + text('GND', 37.4, 35.6, {size: 2});
    return s;
})();

export default {
    id: 'strip',
    name: 'NeoPixel Bar (10 LEDs)',
    category: 'output',
    defaultPort: 'N01',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'NEOPIXEL x10',
        labelAt: [X0 + (((N - 1) * PITCH) / 2), H - 3.6],
        labelSize: 3.4,
        holes: [[6, H - 5], [W - 6, 6], [W - 6, H - 6]],
        silk: SILK
    },
    build (kit, g) {
        RAINBOW.forEach((c, i) => {
            const x = X0 + (i * PITCH);
            smd(kit, g, x + 7.4, CY - 9.6, 'C', true);
            g.add(kit.box({
                x: x - 6,
                y: CY - 6,
                w: 12,
                d: 12,
                h: 3.8,
                z: TOP,
                color: {color: '#f1f1ee', rough: 0.4},
                faces: {t: kit.basic({map: kit.tex.svg(`neopixel-lit-${i}`, 12, 12, pixelSvg(c, i), {ppu: 14, base: '#f1f1ee'})})}
            }));
            g.add(glowDecal(kit, {cx: x, cy: CY, size: 40, z: TOP + 4, color: c, opacity: 0.75}));
        });
    }
};
