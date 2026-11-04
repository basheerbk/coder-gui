import {TOP} from '../lib/parts.js';
import {PCB, PITCH, holeSvg, smd, text} from '../lib/breakout.js';

/*
 * IR line-sensor array — the blue 5-channel TCRT5000 board (about 96 × 20 mm, 2.4 units per mm)
 * with a small purple RJ11 carrier riding on top of it in the middle. The array's 7-pin header
 * (GND, 5V, OUT1–OUT5) stands up into a female header under the carrier; the TCRT5000 sensors
 * hang underneath, looking down at the line.
 */
const W = 76;
const H = 44;
const CY = H / 2;
const A = {w: 230, d: 48};
A.x = (W / 2) - (A.w / 2);
A.y = CY - (A.d / 2);
const GAP = 16;
const A_TOP = -GAP;
const A_Z = A_TOP - 1.6;
const PIN_X = [0, 1, 2, 3, 4, 5, 6].map(i => 50 + ((i - 3) * PITCH));
const PIN_Y = A.y + 9;
const NAMES = ['GND', '5V', 'OUT1', 'OUT2', 'OUT3', 'OUT4', 'OUT5'];
const STATIONS = [0, 1, 2, 3, 4].map(i => 18 + (i * 48.5));

/** Array top artwork in its own frame (u along its length, v across). */
const ARRAY_SVG = (() => {
    let s = `<rect width="${A.w}" height="${A.d}" fill="#2a6fc4"/>`;
    // the two long mounting slots near the ends
    [[8, 8], [A.w - 64, A.d - 15]].forEach(([u, v]) => {
        s += `<rect x="${u}" y="${v}" width="56" height="7" rx="3.5" fill="#0b1520" stroke="#d9dbdd" stroke-width="0.8"/>`;
    });
    // copper traces under the blue mask
    s += '<path d="M 20 30 C 60 22, 90 36, 130 26 S 190 20, 215 28 M 40 40 C 80 34, 120 42, 160 34" fill="none" stroke="#3a80d4" stroke-width="1.2"/>';
    STATIONS.forEach((u, i) => {
        [[-3.4, -2.8], [3.4, -2.8], [-3.4, 2.8], [3.4, 2.8]].forEach(([du, dv]) => {
            s += holeSvg(u + du, 26 + dv, 1.4);
        });
        s += text(String(i + 1), u, 37.5, {size: 2.4});
    });
    s += holeSvg(A.w - 7, 7, 2.6) + holeSvg(7, A.d - 7, 2.6);
    PIN_X.forEach((x, i) => {
        s += holeSvg(x - A.x, 9, 1.8);
        s += text(NAMES[i], x - A.x, 14.2, {size: 1.6, rot: -90, anchor: 'end'});
    });
    s += text('TCRT5000-5CH', 150, 6, {size: 2.6, weight: 700});
    return s;
})();

export default {
    id: 'irline',
    name: 'IR Line Sensor Array',
    category: 'sensor',
    defaultPort: 'I2C1',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'LINE ARRAY',
        labelAt: [52, H - 5],
        labelSize: 3.4,
        holes: [[W - 6, 6]],
        silk: PIN_X.map((x, i) => `<path d="M 26 ${CY + ((i - 3) * 1.6)} H 30 L ${x} ${PIN_Y + 4} V ${PIN_Y}" fill="none" stroke="#6531a3" ` +
            'stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>').join('') +
            PIN_X.map(x => holeSvg(x, PIN_Y, 1.5, '#d4b15e')).join('')
    },
    build (kit, g) {
        // female header under the carrier and the array's male header standing up into it
        g.add(kit.box({x: PIN_X[0] - 3, y: PIN_Y - 3, w: PITCH * 7, d: 6, h: 9, z: -9, color: {color: '#151515', rough: 0.5}}));
        g.add(kit.box({x: PIN_X[0] - 3, y: PIN_Y - 3, w: PITCH * 7, d: 6, h: 3, z: A_TOP, color: {color: '#1d1d1d', rough: 0.5}}));
        PIN_X.forEach(x => g.add(kit.box({x: x - 0.7, y: PIN_Y - 0.7, w: 1.4, d: 1.4, h: GAP - 12, z: A_TOP + 3, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}})));

        // the array board
        g.add(kit.slab({
            x: A.x,
            y: A.y,
            w: A.w,
            d: A.d,
            h: 1.6,
            z: A_Z,
            r: 3,
            top: {map: kit.tex.svg('irline-5ch-top', A.w, A.d, ARRAY_SVG, {ppu: 6, base: '#2a6fc4'}), rough: 0.55},
            side: {color: '#1c4f8f', rough: 0.6}
        }));
        const top = A_TOP - TOP;
        const on = part => {
            part.position.z += top;
            g.add(part);
        };
        // LM339 (SOIC-14) and the tantalum capacitor
        on(kit.box({x: A.x + 128, y: A.y + 20, w: 21, d: 9, h: 2, z: TOP, color: {color: '#151617', rough: 0.45}}));
        for (let i = 0; i < 7; i++) {
            [A.y + 18.6, A.y + 29].forEach(y => on(kit.box({x: A.x + 129.6 + (i * 3), y, w: 1, d: 1.4, h: 0.6, z: TOP, color: {color: '#cfd2d5', metal: 0.8, rough: 0.3}, shadow: false})));
        }
        on(kit.box({x: A.x + 112, y: A.y + 6, w: 7, d: 4.4, h: 3, z: TOP, color: {color: '#e3b52c', rough: 0.4}}));

        // per station: indicator LED, resistors, and the TCRT5000 hanging below
        STATIONS.forEach((u, i) => {
            const x = A.x + u;
            const y = A.y + 26;
            on(kit.cylinder({cx: x + 9, cy: y - 7, r: 2.2, z0: TOP, z1: TOP + 2.6, seg: 18, side: {color: '#111214', rough: 0.3}, top: i === 2 ? kit.basic({color: '#ff4a3a'}) : {color: '#1a1b1e', rough: 0.2}}));
            const a = new (g.constructor)();
            smd(kit, a, x - 13, y - 9);
            smd(kit, a, x - 13, y + 4);
            [...a.children].forEach(c => on(c));
            g.add(kit.box({x: x - 7, y: y - 5.6, w: 6.2, d: 11.2, h: 7, z: A_Z - 7, color: {color: '#1d3f8a', rough: 0.35}}));
            g.add(kit.box({x: x + 0.8, y: y - 5.6, w: 6.2, d: 11.2, h: 7, z: A_Z - 7, color: {color: '#111214', rough: 0.35}}));
        });
    }
};
