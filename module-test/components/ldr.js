import {TOP, soic} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, holeSvg, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * LDR light sensor — the blue LM393 photoresistor board (32 × 14 mm, about 2.4 units per mm),
 * laid out like the real one but mirrored so its right-angle header faces the RJ11 socket:
 * header, mounting hole and the two LEDs by the socket, 201 resistors, the 3362 trimmer over the
 * LM393, capacitors and 103 resistors, then a slightly larger LDR standing up, face to the sky.
 */
const MX = 40;
const MY = 5;
const w = 76;
const d = 34;
const PIN_V = [0, 1, 2].map(i => 7 + (i * PITCH));
const NAMES = ['VCC', 'GND', 'DO'];
const W = MX + w + 8;
const H = MY + d + 13;
const JACK_Y = MY + PIN_V[1];
const DROP_X = MX - 5;
const TRIM = {u: 39, v: 1, s: 12.4, h: 7};
const LDR = {u: 71.5, v: 15.6, r: 8.4, legs: 10};
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
        text('VCC', 12.6, 7.4, {size: 2.4, weight: 700}) +
        '<path d="M 11 13.2 H 14.2 M 11.6 14.2 H 13.6 M 12.2 15.2 H 13" stroke="#f2f4f6" stroke-width="0.45"/>' +
        text('DO', 12.6, 23.4, {size: 2.4, weight: 700}) +
        // outlines: LEDs, the vertical 201s, caps (rounded), 103s, LDR pads with + and -
        LEDS.map(l => `<rect x="${l.u - 0.6}" y="${l.v - 0.6}" width="6.2" height="3.8" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        RES_V.map(([u, v]) => `<rect x="${u - 0.6}" y="${v - 0.6}" width="3.4" height="5.6" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        CAPS.map(([u, v]) => `<rect x="${u - 1}" y="${v - 0.9}" width="6.4" height="4" rx="2" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        RES.map(([u, v]) => `<rect x="${u - 0.6}" y="${v - 0.6}" width="5.6" height="3.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>`).join('') +
        `<rect x="${LDR.u - 2.6}" y="${LDR.v - 6.6}" width="5.2" height="13.2" rx="0.6" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>` +
        holeSvg(LDR.u, LDR.v - 3.4, 1.4) + holeSvg(LDR.u, LDR.v + 3.4, 1.4) +
        text('+', LDR.u - 5.4, LDR.v - 4.6, {size: 3.2, weight: 700}) + text('-', LDR.u - 5.4, LDR.v + 5.4, {size: 3.4, weight: 700})
});

/** 3362 trimmer top: blue body with its markings and the cross-slot rotor. */
const TRIM_SVG = '<rect width="12.4" height="12.4" fill="#2f6fd6"/>' +
    '<rect x="0.4" y="0.4" width="11.6" height="11.6" fill="none" stroke="#5b90e6" stroke-width="0.5"/>' +
    '<text x="6.2" y="2.3" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.4" text-anchor="middle">1  3362  3</text>' +
    '<circle cx="6.2" cy="6" r="3.3" fill="#3b7be0" stroke="#7ea7ec" stroke-width="0.4"/>' +
    '<path d="M6.2 3.2 V8.8" stroke="#121820" stroke-width="1"/>' +
    '<text x="6.2" y="10.4" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.6" text-anchor="middle">P103</text>' +
    '<text x="6.2" y="12" fill="#dfe9fb" font-family="Arial, sans-serif" font-size="1.3" text-anchor="middle">T020</text>';

/** Photoresistor face: cream ceramic with the red-orange CdS track. */
const FACE_SVG = (() => {
    let s = '<rect width="20" height="20" fill="#e8b07a"/><circle cx="10" cy="10" r="9.6" fill="#efc596"/>';
    s += '<circle cx="10" cy="10" r="7.6" fill="#f6ead2"/>';
    let path = 'M 4.4 5.4';
    for (let i = 0; i < 6; i++) {
        const y = 5.4 + (i * 1.84);
        path += ` H ${i % 2 ? 4.4 : 15.6} V ${y + 1.84}`;
    }
    s += `<path d="${path} H 15.6" fill="none" stroke="#c4471f" stroke-width="0.8"/>`;
    return s;
})();

export default {
    id: 'ldr',
    name: 'LDR Sensor',
    category: 'sensor',
    defaultPort: 'A1',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'LDR SENSOR',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(PIN_V.map(v => [DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, DROP_X - 2.2)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'ldr-3362-module', svg, color: PCB.blue});
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
            faces: {t: {map: kit.tex.svg('ldr-3362', TRIM.s, TRIM.s, TRIM_SVG, {ppu: 14, base: '#2f6fd6'}), rough: 0.4}}
        }));
        soic(kit, m, {x: 40, y: 20, w: 11, d: 8});
        CAPS.forEach(([u, v]) => smd(kit, m, u, v, 'C'));
        RES.forEach(([u, v]) => smd(kit, m, u, v, 'R'));

        // LDR standing on its legs, face up
        [-3.4, 3.4].forEach(o => m.add(kit.box({
            x: LDR.u - 0.45,
            y: LDR.v + o - 0.45,
            w: 0.9,
            d: 0.9,
            h: LDR.legs,
            z: TOP,
            color: {color: '#cfd2d5', rough: 0.3, metal: 0.8},
            shadow: false
        })));
        m.add(kit.cylinder({
            cx: LDR.u,
            cy: LDR.v,
            r: LDR.r,
            z0: TOP + LDR.legs,
            z1: TOP + LDR.legs + 3.4,
            seg: 40,
            side: {color: '#e3a66c', rough: 0.5},
            top: {map: kit.tex.svg('ldr-face-big', 20, 20, FACE_SVG, {ppu: 14, base: '#e8b07a'}), rough: 0.3}
        }));
    }
};
