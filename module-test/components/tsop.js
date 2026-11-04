import {TOP, axial} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, holeSvg, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * TSOP IR receiver — the black KY-022 style board with a VS1838B (about 2.4 units per mm): right-angle
 * header (S, +, −) facing the RJ11 socket, the signal LED and its resistor, and the receiver standing
 * on its legs at the far edge with the lens bump looking forward.
 */
const MX = 40;
const MY = 6;
const w = 48;
const d = 36;
const PIN_V = [0, 1, 2].map(i => (d / 2) + ((i - 1) * PITCH));
const NAMES = ['S', '+', '-'];
const W = MX + w + 6;
const H = MY + d + 13;
const JACK_Y = MY + (d / 2);
const DROP_X = MX - 5;
const RX = {u: 34, w: 9, d: 14, h: 17, legs: 5};

const svg = boardSvg({
    w,
    d,
    color: PCB.black[0],
    holes: [[18, 5, 2.8]],
    pins: PIN_V.map(v => ({u: 3.2, v})),
    extra: NAMES.map((n, i) => text(n, 9.2, PIN_V[i], {size: 2.6, weight: 700})).join('') +
        '<rect x="14.4" y="25.4" width="6" height="3.6" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>' +
        '<rect x="14.4" y="11.4" width="5.6" height="3.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>' +
        [-2.54, 0, 2.54].map(o => holeSvg(RX.u + 3.2, (d / 2) + o, 1.1)).join('') +
        text('IR', 26, d - 4, {size: 3, weight: 700})
});

export default {
    id: 'tsop',
    name: 'TSOP',
    category: 'sensor',
    defaultPort: 'N01',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'TSOP',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(PIN_V.map(v => [DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, DROP_X - 2.2)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'tsop-ky022-module', svg, color: PCB.black});
        rightAngleHeader(kit, g, m, {mx: MX, my: MY, vs: PIN_V, dropX: DROP_X});
        smd(kit, m, 15, 12);
        m.add(kit.box({x: 15, y: 26, w: 4.8, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color: '#ff4a3a'})}}));

        // VS1838B: legs, black epoxy body, lens bump on the front (east) face
        [-2.54, 0, 2.54].forEach(o => m.add(kit.box({
            x: RX.u + 2.8,
            y: (d / 2) + o - 0.4,
            w: 0.8,
            d: 0.8,
            h: RX.legs,
            z: TOP,
            color: {color: '#cfd2d5', rough: 0.3, metal: 0.8},
            shadow: false
        })));
        m.add(kit.box({x: RX.u, y: (d / 2) - (RX.d / 2), w: RX.w, d: RX.d, h: RX.h, z: TOP + RX.legs, color: {color: '#141519', rough: 0.35}}));
        m.add(axial(kit, {x0: RX.u + RX.w, x1: RX.u + RX.w + 2.6, cy: d / 2, cz: TOP + RX.legs + 11, r: 3.8, seg: 24, side: {color: '#141519', rough: 0.2}, top: {color: '#22232a', rough: 0.12}}));
    }
};
