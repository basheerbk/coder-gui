import {TOP, soic} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, holeSvg, led5, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * Flame sensor — the common 4-pin blue LM393 board (32 × 14 mm, about 2.4 units per mm), mirrored
 * so its right-angle header faces the RJ11 socket: header and mounting hole by the socket, the
 * PWR and DO LEDs, the tall blue 3296 multi-turn trimmer over the LM393, resistors, then the black
 * IR photodiode lying off the far edge to look for flame.
 */
const MX = 40;
const MY = 5;
const w = 76;
const d = 34;
const PIN_V = [0, 1, 2, 3].map(i => 7.85 + (i * PITCH));
const NAMES = ['AO', 'GND', 'VCC', 'DO'];
const W = MX + w + 5;
const H = MY + d + 13;
const JACK_Y = MY + ((PIN_V[1] + PIN_V[2]) / 2);
const DROP_X = MX - 5;
const TRIM = {u: 34, v: 1.4, w: 9.6, d: 23, h: 24};
const RES = [[50, 4], [50, 9.6], [50, 22.4], [50, 28]];
const LEDS = [{u: 15, v: 2.4, label: 'PWR', lit: true}, {u: 15, v: 28.8, label: 'DO', lit: false}];
const PD = {v: d / 2, legsU: 62};

const svg = boardSvg({
    w,
    d,
    color: PCB.blue[0],
    pins: PIN_V.map(v => ({u: 3.2, v})),
    extra: holeSvg(17.6, d / 2, 3.4) +
        NAMES.map((n, i) => text(n, 9.6, PIN_V[i], {size: 2, anchor: 'start', weight: 700})).join('') +
        LEDS.map(l => `<rect x="${l.u - 0.6}" y="${l.v - 0.6}" width="6.2" height="3.8" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>` +
            text(l.label, l.u + 2.5, l.v < 10 ? l.v + 6.2 : l.v - 2.6, {size: 1.8})).join('') +
        RES.map(([u, v]) => `<rect x="${u - 0.5}" y="${v - 0.5}" width="5.4" height="3.2" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        holeSvg(PD.legsU, PD.v - 1.3, 1.2) + holeSvg(PD.legsU, PD.v + 1.3, 1.2) +
        text('Flame', 60, d - 3, {size: 2.2, weight: 700})
});

/** 3296W trimmer top: brass screw at one end and the 103 marking. */
const TRIM_SVG = `<rect width="${TRIM.w}" height="${TRIM.d}" fill="#2f6fd6"/>` +
    `<circle cx="${TRIM.w / 2}" cy="4.4" r="3.2" fill="#d8b25a" stroke="#9c7a2c" stroke-width="0.5"/>` +
    `<path d="M${(TRIM.w / 2) - 2.2} 4.4 H${(TRIM.w / 2) + 2.2}" stroke="#6e5418" stroke-width="0.9"/>` +
    `<text x="${TRIM.w / 2}" y="15" fill="#e8eef8" font-family="Arial, sans-serif" font-size="2.6" text-anchor="middle" ` +
    `transform="rotate(90 ${TRIM.w / 2} 15)">3296 103</text>`;

export default {
    id: 'flame',
    name: 'Flame Sensor',
    category: 'sensor',
    defaultPort: 'A2',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'FLAME SENSOR',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(PIN_V.map(v => [DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, DROP_X - 2.2)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'flame-3296-module', svg, color: PCB.blue});
        rightAngleHeader(kit, g, m, {mx: MX, my: MY, vs: PIN_V, dropX: DROP_X});

        LEDS.forEach(l => m.add(kit.box({
            x: l.u,
            y: l.v,
            w: 5,
            d: 2.6,
            h: 1.2,
            z: TOP,
            color: {color: '#e8e5dc', rough: 0.4},
            faces: {t: l.lit ? kit.basic({color: '#ff4a3a'}) : {color: '#f2f6f8', rough: 0.15}}
        })));
        m.add(kit.box({
            x: TRIM.u,
            y: TRIM.v,
            w: TRIM.w,
            d: TRIM.d,
            h: TRIM.h,
            z: TOP,
            color: {color: '#2a62c4', rough: 0.45},
            faces: {t: {map: kit.tex.svg('flame-3296', TRIM.w, TRIM.d, TRIM_SVG, {ppu: 12, base: '#2f6fd6'}), rough: 0.4}}
        }));
        soic(kit, m, {x: 22, y: 21, w: 10, d: 8});
        RES.forEach(([u, v], i) => smd(kit, m, u, v, i === 1 ? 'C' : 'R'));

        // black IR photodiode lying off the far edge, legs bent down into its pads
        led5(kit, m, {x: PD.legsU + 6, y: PD.v, dir: 'e', cz: TOP + 6.6, color: '#0f1013', opacity: 1, key: 'flame-pd'});
    }
};
