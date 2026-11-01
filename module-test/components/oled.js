import {Group} from 'three';

import {PCB_H} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {BLACK, TOP} from '../lib/parts.js';

/*
 * 0.96" I2C OLED (SSD1306, 128 × 64) — the common 27 × 27 mm module, about 2.4 units per mm —
 * standing on its 4-pin header over a purple RJ11 carrier. The module is turned a quarter turn so
 * its header pins face the RJ11 socket (west), next to the carrier's traces.
 */
const MS = 66;
const MOD = {x: 34, y: 8};
const W = MOD.x + MS + 6;
const H = MOD.y + MS + 8;
const SPACER_H = 6;
const PITCH = 6.1;
const PIN_U = [0, 1, 2, 3].map(i => (MS / 2) + ((i - 1.5) * PITCH));
const PIN_V = 4;
const PIN_NAMES = ['GND', 'VCC', 'SCL', 'SDA'];
const GLASS = {u: 1, v: 11, w: 64, d: 46, h: 3.4};
const ACTIVE = {x: 6, y: 3, w: 52, d: 27};

const BLUE = '#1c5d8f';
const SILK = '#f2f4f6';

const MODULE_SVG = `<rect width="${MS}" height="${MS}" fill="${BLUE}"/>` +
    [[3.6, 3.6], [MS - 3.6, 3.6], [3.6, MS - 3.6], [MS - 3.6, MS - 3.6]].map(([x, y]) => (
        `<circle cx="${x}" cy="${y}" r="2.6" fill="#d9dbdd"/><circle cx="${x}" cy="${y}" r="1.4" fill="#0b1a26"/>`
    )).join('') +
    PIN_U.map((u, i) => `<circle cx="${u}" cy="${PIN_V}" r="2.1" fill="#d9dbdd"/><circle cx="${u}" cy="${PIN_V}" r="1" fill="#10202e"/>` +
        `<text x="${u}" y="8.6" fill="${SILK}" font-family="Arial, sans-serif" font-size="2.1" text-anchor="middle" ` +
        `dominant-baseline="middle">${PIN_NAMES[i]}</text>`).join('');

/** The lit screen: yellow status band over a blue body, drawn like 128 × 64 pixels. */
const SCREEN_SVG = (() => {
    const yb = ACTIVE.y + (ACTIVE.d / 4);
    const px = ACTIVE.w / 128;
    const bars = [9, 14, 11, 18, 22, 16, 25, 20, 13, 17, 23, 19].map((hh, i) => {
        const x = ACTIVE.x + 31 + (i * 2.1);
        const h = hh * 0.42;
        return `<rect x="${x}" y="${ACTIVE.y + ACTIVE.d - 2 - h}" width="1.5" height="${h}" fill="#8fd8ff"/>`;
    }).join('');
    return `<rect width="${GLASS.w}" height="${GLASS.d}" fill="#22252b"/>` +
        `<rect x="0.6" y="0.6" width="${GLASS.w - 1.2}" height="${GLASS.d - 1.2}" fill="none" stroke="#3a3e46" stroke-width="0.5"/>` +
        `<rect x="${ACTIVE.x}" y="${ACTIVE.y}" width="${ACTIVE.w}" height="${ACTIVE.d}" fill="#05070a"/>` +
        '<g font-family="Consolas, \'Courier New\', monospace" font-weight="700">' +
        `<text x="${ACTIVE.x + 1.5}" y="${ACTIVE.y + 4.6}" font-size="4.2" fill="#ffd54a">12:45</text>` +
        `<text x="${ACTIVE.x + ACTIVE.w - 1.5}" y="${ACTIVE.y + 4.6}" font-size="4.2" fill="#ffd54a" text-anchor="end">A0 72%</text>` +
        `<text x="${ACTIVE.x + 1.5}" y="${yb + 7.6}" font-size="5.4" fill="#8fd8ff">Tinker</text>` +
        `<text x="${ACTIVE.x + 1.5}" y="${yb + 14.8}" font-size="5.4" fill="#8fd8ff">Bit</text>` +
        `<text x="${ACTIVE.x + 1.5}" y="${ACTIVE.y + ACTIVE.d - 1.6}" font-size="2.6" fill="#8fd8ff">OLED 128x64</text></g>` +
        `<line x1="${ACTIVE.x + 30}" y1="${ACTIVE.y + ACTIVE.d - 1.6}" x2="${ACTIVE.x + ACTIVE.w - 1}" y2="${ACTIVE.y + ACTIVE.d - 1.6}" ` +
        `stroke="#8fd8ff" stroke-width="${px * 1.6}"/>${bars}` +
        // the FPC tail and driver area along the bottom of the glass
        `<rect x="${(GLASS.w / 2) - 12}" y="${GLASS.d - 7}" width="24" height="5" rx="1" fill="#2c2f36"/>`;
})();

/** Carrier: traces from the RJ11 socket in under the module to the header pads. */
const CARRIER_SILK = PIN_U.map((u, i) => {
    const jy = (H / 2) + ((i - 1.5) * 2.4);
    return `<path d="M 26 ${jy} H 31 L ${MOD.x + PIN_V} ${MOD.y + MS - u}" fill="none" stroke="#6531a3" stroke-width="1" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>';
}).join('');

/** 0.96" SSD1306 OLED on its header over the RJ11 carrier. */
export default {
    id: 'oled',
    name: 'OLED Screen',
    category: 'output',
    defaultPort: 'I2C',
    spec: {
        w: W,
        h: H,
        jackY: H / 2,
        label: 'OLED I2C',
        labelAt: [17, H - 6],
        labelSize: 3.8,
        holes: [[6, 6]],
        silk: CARRIER_SILK
    },
    build (kit, g) {
        g.add(kit.box({
            x: MOD.x + PIN_V - 3,
            y: MOD.y + PIN_U[0] - (PITCH / 2),
            w: 6,
            d: PITCH * 4,
            h: SPACER_H,
            z: TOP,
            color: BLACK
        }));

        // module frame: (u, v) from its own top-left corner, turned so its north (header) edge faces west
        const m = new Group();
        const [mx, my] = at(MOD.x, MOD.y + MS);
        m.position.set(mx, my, TOP + SPACER_H);
        m.rotation.z = Math.PI / 2;
        g.add(m);

        m.add(kit.slab({
            x: 0,
            y: 0,
            w: MS,
            d: MS,
            h: PCB_H,
            r: 1.5,
            top: {map: kit.tex.svg('oled-module-top', MS, MS, MODULE_SVG, {ppu: 10, base: BLUE}), rough: 0.55},
            side: {color: '#123f63', rough: 0.6}
        }));

        PIN_U.forEach(u => {
            m.add(kit.cylinder({cx: u, cy: PIN_V, r: 1.6, z0: TOP, z1: TOP + 0.9, side: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, seg: 16}));
            m.add(kit.box({x: u - 0.7, y: PIN_V - 0.7, w: 1.4, d: 1.4, h: 2.2, z: TOP, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}, shadow: false}));
        });

        // adhesive pad, then the glass panel with the lit screen
        m.add(kit.box({x: GLASS.u + 2, y: GLASS.v + 2, w: GLASS.w - 4, d: GLASS.d - 4, h: 0.5, z: TOP, color: {color: '#e8e4d8', rough: 0.8}}));
        m.add(kit.box({
            x: GLASS.u,
            y: GLASS.v,
            w: GLASS.w,
            d: GLASS.d,
            h: GLASS.h,
            z: TOP + 0.5,
            color: {color: '#2a2d33', rough: 0.2, metal: 0.1},
            faces: {t: kit.basic({map: kit.tex.svg('oled-screen', GLASS.w, GLASS.d, SCREEN_SVG, {ppu: 14, base: '#22252b'})})}
        }));
        // FPC folding round the bottom edge
        m.add(kit.box({x: (MS / 2) - 10, y: GLASS.v + GLASS.d - 0.5, w: 20, d: 2.4, h: GLASS.h + 0.4, z: TOP, color: {color: '#b8792a', rough: 0.4}}));
    }
};
