import {TOP, sot23} from '../lib/parts.js';
import {PCB, PITCH, boardSvg, carrierPinNames, carrierTraces, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * Water level sensor — the red 62 × 20 mm board (about 2.4 units per mm): right-angle header (S, +, −)
 * facing the RJ11 socket, S8050 transistor, resistors and power LED by the header, and the exposed
 * comb of sense traces reaching out past the small carrier.
 */
const MX = 40;
const MY = 6;
const w = 149;
const d = 48;
const PIN_V = [0, 1, 2].map(i => (d / 2) + ((i - 1) * PITCH));
const NAMES = ['S', '+', '-'];
const W = MX + 44;
const H = MY + d + 13;
const JACK_Y = MY + (d / 2);
const DROP_X = MX - 5;

/** Ten exposed fingers, alternately tied to the two rails along the top and bottom. */
const COMB = (() => {
    let s = '<rect x="40" y="3" width="106" height="2" fill="#d7d9db"/><rect x="40" y="43" width="106" height="2" fill="#d7d9db"/>';
    for (let i = 0; i < 10; i++) {
        const y = 7.2 + (i * 3.6);
        const fromLeft = i % 2 === 0;
        s += `<rect x="${fromLeft ? 40 : 47}" y="${y}" width="99" height="1.8" fill="#d7d9db"/>`;
        s += `<rect x="${fromLeft ? 40 : 144}" y="${fromLeft ? 3 : y}" width="2" height="${fromLeft ? y - 3 + 1.8 : 45 - y}" fill="#d7d9db"/>`;
    }
    return s;
})();

const svg = boardSvg({
    w,
    d,
    color: PCB.red[0],
    holes: [[33, 6.4, 3]],
    pins: PIN_V.map(v => ({u: 3.2, v})),
    extra: COMB +
        NAMES.map((n, i) => text(n, 9.4, PIN_V[i], {size: 2.6, weight: 700})).join('') +
        text('Water Sensor', 24, d - 4.4, {size: 2.4, weight: 700}) +
        '<rect x="20.4" y="29.4" width="6" height="3.6" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.3"/>' +
        text('PWR', 23.4, 36.2, {size: 1.8})
});

export default {
    id: 'water',
    name: 'Water Level Sensor',
    category: 'sensor',
    defaultPort: 'A3',
    spec: {
        w: W,
        h: H,
        jackY: JACK_Y,
        label: 'WATER SENSOR',
        labelAt: [MX + 2, H - 5],
        labelSize: 3.4,
        holes: [[6, H - 6]],
        silk: carrierTraces(PIN_V.map(v => [DROP_X, MY + v]), JACK_Y) +
            carrierPinNames(PIN_V.map(v => [0, MY + v]), NAMES, DROP_X - 2.2)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'water-red-module', svg, color: PCB.red});
        rightAngleHeader(kit, g, m, {mx: MX, my: MY, vs: PIN_V, dropX: DROP_X});
        sot23(kit, m, {x: 14, y: 8});
        smd(kit, m, 14, 16);
        smd(kit, m, 22, 16);
        smd(kit, m, 22, 24);
        m.add(kit.box({x: 21, y: 30, w: 4.8, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color: '#ff4a3a'})}}));
    }
};
