import {TOP, glowDecal} from '../lib/parts.js';
import {smd, text} from '../lib/breakout.js';

/*
 * RGB light — a single WS2812B (5050) NeoPixel soldered straight onto the purple RJ11 carrier,
 * with its 100 nF decoupling capacitor, shown lit.
 */
const W = 70;
const H = 46;
const CY = H / 2;
const LED = {x: 50, y: CY};

/** Lit 5050 top: white body, glowing window with the three dies and the driver chip. */
const PIXEL = '<rect width="12" height="12" fill="#f1f1ee"/>' +
    '<defs><radialGradient id="lit"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#b38bff"/>' +
    '<stop offset="1" stop-color="#7a4dff" stop-opacity="0.4"/></radialGradient></defs>' +
    '<circle cx="6" cy="6" r="4.7" fill="#dfe6ee"/><circle cx="6" cy="6" r="4.7" fill="url(#lit)"/>' +
    '<rect x="4.2" y="4.6" width="1.1" height="1.1" fill="#ff4040"/><rect x="5.6" y="4.6" width="1.1" height="1.1" fill="#40ff60"/>' +
    '<rect x="7" y="4.6" width="1.1" height="1.1" fill="#4080ff"/><rect x="5" y="6.6" width="2.2" height="1.6" fill="#555"/>' +
    '<path d="M 0 0 L 1.6 0 L 0 1.6 Z" fill="#9aa0a5"/>';

export default {
    id: 'rgb',
    name: 'RGB Light (NeoPixel)',
    category: 'output',
    defaultPort: 'N01',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'RGB LED',
        labelAt: [LED.x - 4, H - 3.8],
        labelSize: 3.2,
        holes: [[W - 6, 6], [W - 6, H - 6]],
        silk: `<rect x="${LED.x - 8}" y="${LED.y - 8}" width="16" height="16" fill="none" stroke="#f2f4f6" stroke-width="0.5"/>` +
            `<path d="M ${LED.x - 8} ${LED.y - 5.6} L ${LED.x - 5.6} ${LED.y - 8}" stroke="#f2f4f6" stroke-width="0.5"/>` +
            // 5V, DIN and GND traces from the socket to the LED's pads
            `<path d="M 26 ${CY - 3} H 31 V ${CY - 12} H ${LED.x + 4} V ${LED.y - 6}" stroke="#6531a3" stroke-width="1.2" fill="none"/>` +
            `<path d="M 26 ${CY} H ${LED.x - 6}" stroke="#6531a3" stroke-width="1.2" fill="none"/>` +
            `<path d="M 26 ${CY + 3} H 31 V ${CY + 12} H ${LED.x + 4} V ${LED.y + 6}" stroke="#6531a3" stroke-width="1.2" fill="none"/>` +
            '<path d="M 33 27.6 H 39 M 37 26.2 L 39 27.6 L 37 29" fill="none" stroke="#f2f4f6" stroke-width="0.5"/>' +
            text('DIN', 36, CY + 8.6, {size: 2.2}) + text('5V', 34.4, CY - 13.6, {size: 2}) + text('GND', 35, CY + 15.2, {size: 2}) +
            text('C1', LED.x + 11.8, LED.y - 6.2, {size: 2})
    },
    build (kit, g, {options}) {
        const color = options.color || '#9b6bff';
        smd(kit, g, LED.x + 9.6, LED.y - 4.2, 'C', true);
        g.add(kit.box({
            x: LED.x - 6,
            y: LED.y - 6,
            w: 12,
            d: 12,
            h: 3.8,
            z: TOP,
            color: {color: '#f1f1ee', rough: 0.4},
            faces: {t: kit.basic({map: kit.tex.svg('ws2812-lit', 12, 12, PIXEL, {ppu: 16, base: '#f1f1ee'})})}
        }));
        g.add(glowDecal(kit, {cx: LED.x, cy: LED.y, size: 52, z: TOP + 4, color, opacity: 0.85}));
    }
};
