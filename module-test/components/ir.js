import {PCB_H} from '../lib/board-data.js';
import {BLACK, TOP, soic} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, holeSvg, led5, smd, stack, text} from '../lib/breakout.js';

/*
 * IR obstacle sensor — the blue MH-B / FC-51 board (31 × 14 mm, about 2.4 units per mm), laid out
 * like the real one but mirrored so its right-angle header faces the RJ11 socket: header and
 * mounting hole by the socket, power / obstacle LEDs, square trimmer over the LM393, capacitors and
 * resistors, then the black receiver (top) and clear emitter (bottom) lying off the far edge.
 */
const MX = 40;
const MY = 5;
const w = 74;
const d = 34;
const SPACER_H = 6;
const PIN_V = [0, 1, 2].map(i => 9 + (i * PITCH));
const NAMES = ['VCC', 'GND', 'OUT'];
const W = MX + w + 5;
const H = MY + d + 13;
const JACK_Y = MY + PIN_V[1];
const PIN_DROP_X = MX - 5;
const TRIM = {u: 27, v: 0.8, s: 12, h: 7};
const RES = [[46, 15.4], [46, 20.4], [46, 25.4], [46, 30.2]];
const CAPS = [[51, 3.6], [51, 9.6]];
const LEDS = [{v: 7.2, label: 'PWR', ly: 2.6}, {v: 24.4, label: 'OBS', ly: 31.6}];

const svg = boardSvg({
    w,
    d,
    color: PCB.blue[0],
    pins: PIN_V.map(v => ({u: 3.2, v})),
    extra: holeSvg(12.5, 16.5, 3) +
        text('MH-B', 9, 3, {size: 2.6, weight: 700}) +
        text('VCC GND OUT', 9.4, 15.2, {size: 2.2, rot: -90}) +
        LEDS.map(l => `<rect x="17.4" y="${l.v - 2}" width="6.2" height="4" rx="0.5" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>` +
            text(l.label, 20.5, l.ly, {size: 2})).join('') +
        // through-hole pads where the two IR LEDs' legs go in
        [7.2 - 1.3, 7.2 + 1.3, 22.2 - 1.3, 22.2 + 1.3].map(v => holeSvg(60.5, v, 1.2)).join('') +
        // silk outlines of the passives
        [...RES, ...CAPS].map(([u, v]) => `<rect x="${u - 0.5}" y="${v - 0.5}" width="5.4" height="3.2" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('')
});

/** Square cermet trimmer top: blue body, white cross-slot dial. */
const TRIM_SVG = '<rect width="12" height="12" fill="#2f6fd6"/>' +
    '<rect x="0.4" y="0.4" width="11.2" height="11.2" fill="none" stroke="#5b90e6" stroke-width="0.5"/>' +
    '<circle cx="6" cy="6" r="4" fill="#f2f2ee"/><circle cx="6" cy="6" r="4" fill="none" stroke="#c9c9c3" stroke-width="0.4"/>' +
    '<path d="M3.6 6 H8.4 M6 3.6 V8.4" stroke="#9a9a94" stroke-width="0.9"/>' +
    '<text x="6" y="11.3" fill="#e2ebfb" font-family="Arial, sans-serif" font-size="1.6" text-anchor="middle">103</text>';

export default {
    id: 'ir',
    name: 'IR Sensor',
    category: 'sensor',
    defaultPort: 'D13',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'IR SENSOR',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(PIN_V.map(v => [PIN_DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, PIN_DROP_X - 2.2)
    },
    build (kit, g) {
        // black support under the header edge, then the board itself (no pins underneath)
        g.add(kit.box({x: MX, y: MY + PIN_V[0] - 3, w: 6, d: (PITCH * 2) + 6, h: SPACER_H, z: TOP, color: BLACK}));
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'ir-mhb-module', svg, color: PCB.blue, spacer: SPACER_H});

        // right-angle header: plastic strip on the board, pins out west then bent down into the carrier
        const top = TOP + SPACER_H + PCB_H;
        m.add(kit.box({x: 0.8, y: PIN_V[0] - 3, w: 5, d: (PITCH * 2) + 6, h: 2.6, z: TOP, color: {color: '#151515', rough: 0.5}}));
        PIN_V.forEach(v => {
            m.add(kit.cylinder({cx: 3.2, cy: v, r: 1.4, z0: TOP, z1: TOP + 0.6, side: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, seg: 12}));
            g.add(kit.box({x: PIN_DROP_X - 0.7, y: MY + v - 0.7, w: MX + 3.2 - PIN_DROP_X + 1.4, d: 1.4, h: 1.4, z: top + 0.6, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}}));
            g.add(kit.box({x: PIN_DROP_X - 0.7, y: MY + v - 0.7, w: 1.4, d: 1.4, h: top + 2 - TOP + 1.2, z: TOP - 1.2, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}}));
        });

        // indicator LEDs: water-clear SMD parts, power lit
        LEDS.forEach((l, i) => {
            m.add(kit.box({x: 18, y: l.v - 1.4, w: 5, d: 2.8, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: i === 0 ? kit.basic({color: '#ff4a3a'}) : {color: '#f2f6f8', rough: 0.15}}}));
        });

        // square trimmer over the LM393
        m.add(kit.box({
            x: TRIM.u,
            y: TRIM.v,
            w: TRIM.s,
            d: TRIM.s,
            h: TRIM.h,
            z: TOP,
            color: {color: '#2a62c4', rough: 0.45},
            faces: {t: {map: kit.tex.svg('ir-trimmer', TRIM.s, TRIM.s, TRIM_SVG, {ppu: 14, base: '#2f6fd6'}), rough: 0.4}}
        }));
        soic(kit, m, {x: 28, y: 21, w: 11, d: 8});

        // capacitors (top) and the resistor column
        CAPS.forEach(([u, v]) => smd(kit, m, u, v, 'C'));
        RES.forEach(([u, v]) => smd(kit, m, u, v, 'R'));

        // IR pair: black receiver on top, clear emitter below, legs bent down into the pads
        led5(kit, m, {x: 66, y: 7.2, dir: 'e', cz: TOP + 6.6, color: '#111216', opacity: 1, key: 'ir-rx'});
        led5(kit, m, {x: 66, y: 22.2, dir: 'e', cz: TOP + 6.6, color: '#dde8f2', opacity: 0.55, key: 'ir-tx'});
    }
};
