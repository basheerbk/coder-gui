import {TOP, soic} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, holeSvg, lead, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * Reed switch module — the blue HW-072 board (32 × 14 mm, about 2.4 units per mm), the same layout as
 * the LDR board, mirrored so its right-angle header faces the RJ11 socket: header, mounting hole and
 * the two LEDs by the socket, 201 resistors, the 3362 trimmer over the LM393, capacitors and 103
 * resistors, then the green-tinted glass reed held past the end of the board on its long bent leads.
 */
const MX = 40;
const MY = 5;
const w = 76;
const d = 34;
const PIN_V = [0, 1, 2].map(i => 7 + (i * PITCH));
const NAMES = ['VCC', 'GND', 'DO'];
const W = MX + w + 22;
const H = MY + d + 8;
const JACK_Y = MY + PIN_V[1];
const DROP_X = MX - 5;
const TRIM = {u: 39, v: 1, s: 12.4, h: 7};
const PADS = {u: 71.5, v: 15.6};
const REED = {u: w + 13, v0: 2, v1: 29.2, r: 2.2, cz: TOP + 4};
const CAPS = [[59.6, 3.4], [59.6, 10.6]];
const RES = [[59.6, 18.4, '103'], [59.6, 25.6, 'EDT']];
const RES_V = [[29.6, 3.6], [29.6, 24.6]];
const LEDS = [{u: 16.4, v: 1.8, lit: true}, {u: 16.4, v: 29.4, lit: false}];

const svg = boardSvg({
    w,
    d,
    color: PCB.blue[0],
    pins: PIN_V.map(v => ({u: 3.2, v})),
    holes: [[72.6, 2.6, 1.6], [72.6, 31.4, 1.6]],
    extra: holeSvg(20, 17.4, 3.6) +
        text('HW-072', 33, 31.4, {size: 2, weight: 700}) +
        text('VCC', 12.6, 7.4, {size: 2.4, weight: 700}) +
        '<path d="M 11 13.2 H 14.2 M 11.6 14.2 H 13.6 M 12.2 15.2 H 13" stroke="#f2f4f6" stroke-width="0.45"/>' +
        text('DO', 12.6, 23.4, {size: 2.4, weight: 700}) +
        // outlines: LEDs, the vertical 201s, caps (rounded), 103s, reed pads with + and -
        LEDS.map(l => `<rect x="${l.u - 0.6}" y="${l.v - 0.6}" width="6.2" height="3.8" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        RES_V.map(([u, v]) => `<rect x="${u - 0.6}" y="${v - 0.6}" width="3.4" height="5.6" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        CAPS.map(([u, v]) => `<rect x="${u - 1}" y="${v - 0.9}" width="6.4" height="4" rx="2" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        RES.map(([u, v]) => `<rect x="${u - 0.6}" y="${v - 0.6}" width="5.6" height="3.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        `<rect x="${PADS.u - 2.6}" y="${PADS.v - 6.6}" width="5.2" height="13.2" rx="0.6" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>` +
        holeSvg(PADS.u, PADS.v - 3.4, 1.4) + holeSvg(PADS.u, PADS.v + 3.4, 1.4) +
        text('+', PADS.u - 5.4, PADS.v - 4.6, {size: 3.2, weight: 700}) + text('-', PADS.u - 5.4, PADS.v + 5.4, {size: 3.4, weight: 700})
});

/** 3362 trimmer top: blue body with its markings and the cross-slot rotor. */
const TRIM_SVG = '<rect width="12.4" height="12.4" fill="#2f6fd6"/>' +
    '<rect x="0.4" y="0.4" width="11.6" height="11.6" fill="none" stroke="#5b90e6" stroke-width="0.5"/>' +
    '<text x="6.2" y="2.3" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.4" text-anchor="middle">1  3362  3</text>' +
    '<circle cx="6.2" cy="6" r="3.3" fill="#3b7be0" stroke="#7ea7ec" stroke-width="0.4"/>' +
    '<path d="M6.2 3.2 V8.8" stroke="#121820" stroke-width="1"/>' +
    '<text x="6.2" y="10.4" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.6" text-anchor="middle">P103</text>' +
    '<text x="6.2" y="12" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.3" text-anchor="middle">T020</text>';

const GLASS = {color: '#9fd8b4', rough: 0.05, opacity: 0.42};
const REED_METAL = {color: '#8f8a7e', rough: 0.3, metal: 0.8};

export default {
    id: 'reed',
    name: 'Reed Switch',
    category: 'sensor',
    defaultPort: 'D13',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'REED SWITCH',
        labelAt: [MX + (w / 2), H - 3.6],
        labelSize: 3.2,
        holes: [[6, H - 5]],
        silk: carrierTraces(PIN_V.map(v => [DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, DROP_X - 2.2)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'reed-hw072-module', svg, color: PCB.blue});
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
        RES_V.forEach(([u, v]) => smd(kit, m, u, v, 'R', true));
        m.add(kit.box({
            x: TRIM.u,
            y: TRIM.v,
            w: TRIM.s,
            d: TRIM.s,
            h: TRIM.h,
            z: TOP,
            color: {color: '#2a62c4', rough: 0.45},
            faces: {t: {map: kit.tex.svg('reed-3362', TRIM.s, TRIM.s, TRIM_SVG, {ppu: 14, base: '#2f6fd6'}), rough: 0.4}}
        }));
        soic(kit, m, {x: 40, y: 20, w: 11, d: 8});
        CAPS.forEach(([u, v]) => smd(kit, m, u, v, 'C'));
        RES.forEach(([u, v]) => smd(kit, m, u, v, 'R'));

        // glass reed past the board's end, across it, on two long bent leads from the + / - pads
        const {u, v0, v1, r, cz} = REED;
        const len = v1 - v0 - 6;
        const glass = kit.cylinder({cx: 0, cy: 0, r, z0: -len / 2, z1: len / 2, seg: 20, side: GLASS, top: GLASS, bottom: GLASS});
        glass.rotation.x = Math.PI / 2;
        glass.position.set(u, -((v0 + v1) / 2), cz);
        m.add(glass);
        m.add(kit.box({x: u - 0.5, y: v0 + 5, w: 1, d: 9, h: 0.5, z: cz - 0.2, color: REED_METAL}));
        m.add(kit.box({x: u - 0.5, y: v1 - 14, w: 1, d: 9, h: 0.5, z: cz + 0.25, color: REED_METAL}));
        lead(kit, m, ['#cfd2d5', '#cfd2d5'], (k, i) => (i === 0 ? [
            [PADS.u, PADS.v - 3.4, TOP],
            [PADS.u, PADS.v - 3.4, TOP + 3],
            [PADS.u + 5, v0 + 2, cz + 2],
            [u, v0 - 1, cz],
            [u, v0 + 4, cz]
        ] : [
            [PADS.u, PADS.v + 3.4, TOP],
            [PADS.u, PADS.v + 3.4, TOP + 3],
            [PADS.u + 5, v1 - 2, cz + 2],
            [u, v1 + 1, cz],
            [u, v1 - 4, cz]
        ]), 0.45);
    }
};
