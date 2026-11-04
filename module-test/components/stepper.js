import {TOP} from '../lib/parts.js';
import {PCB, boardSvg, carrierPinNames, carrierTraces, lead, ledSmd, pinColumn, stack, text} from '../lib/breakout.js';

/*
 * Stepper 28BYJ-48 + ULN2003: the green ULN2003 driver board (35 × 32 mm) stacked on the purple
 * RJ11 carrier, and the 28 mm stepper on the table, its 5-wire lead in the board's white socket.
 */
const MX = 36;
const MY = 5;
const w = 84;
const d = 77;
const pins = pinColumn(6, 3, d / 2);
const names = ['IN1', 'IN2', 'IN3', 'IN4', '-', '+'];
const world = pins.map(p => [MX + p.u, MY + p.v]);
const W = MX + w + 5;
const H = MY + d + 12;
const WIRES = ['#2e6fd8', '#ff8fb6', '#f2d21b', '#f28c1c', '#d0302a'];
const MOTOR = {cx: W + 70, cy: H / 2, r: 33.6, h: 45.6};

const svg = boardSvg({
    w,
    d,
    color: PCB.green[0],
    holes: [[5, 5, 3.4], [w - 5, 5, 3.4], [5, d - 5, 3.4], [w - 5, d - 5, 3.4]],
    pins,
    extra: ['A', 'B', 'C', 'D'].map((n, i) => text(n, 64, 13 + (i * 8), {size: 2.4})).join('') +
        text('ULN2003', 36, d - 6, {size: 2.8, weight: 700}) + text('5-12V', 12, d - 12, {size: 2})
});

const DIP = '<rect width="46" height="15" fill="#1a1b1d"/><circle cx="3" cy="7.5" r="1.8" fill="#0d0d0f"/>' +
    '<text x="24" y="9.4" fill="#7b7e84" font-family="Arial, sans-serif" font-size="4" text-anchor="middle">ULN2003APG</text>';

const MOTOR_TOP = '<rect width="68" height="68" fill="#cfd2d5"/><circle cx="34" cy="34" r="33" fill="#c3c6c9"/>' +
    '<circle cx="34" cy="34" r="27" fill="none" stroke="#b3b6b9" stroke-width="0.8"/>' +
    '<text x="34" y="50" fill="#6c6f75" font-family="Arial, sans-serif" font-size="4.6" text-anchor="middle">28BYJ-48  5VDC</text>';

export default {
    id: 'stepper',
    name: 'Stepper 28BYJ-48 + ULN2003',
    category: 'output',
    defaultPort: 'STEPPER1',
    spec: {
        w: W,
        h: H,
        jackY: MY + (d / 2),
        label: 'STEPPER',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(world, MY + (d / 2), {spread: 1.8, width: 0.9}) + carrierPinNames(world, names, MX - 1.5)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'uln2003-module', svg, color: PCB.green, pins});
        // DIP-16 with legs, A–D LEDs, jumper and the white 5-pin motor socket
        for (let i = 0; i < 8; i++) {
            [24, 42].forEach(v => m.add(kit.box({x: 15 + (i * 6.1), y: v - 1, w: 1.4, d: 3, h: 3, z: TOP, color: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, shadow: false})));
        }
        m.add(kit.box({
            x: 13,
            y: 25.5,
            w: 46,
            d: 15,
            h: 8,
            z: TOP + 1.2,
            color: {color: '#18191b', rough: 0.45},
            faces: {t: {map: kit.tex.svg('uln2003-dip', 46, 15, DIP, {ppu: 10, base: '#1a1b1d'}), rough: 0.45}}
        }));
        [0, 1, 2, 3].forEach(i => m.add(kit.cylinder({cx: 70, cy: 13 + (i * 8), r: 3, z0: TOP, z1: TOP + 4, seg: 20, side: {color: '#ff3030', rough: 0.2, opacity: 0.85}, top: {color: '#ff4a4a', rough: 0.2}})));
        ledSmd(kit, m, 14, d - 18, '#ff3030');
        m.add(kit.box({x: 6, y: 50, w: 6, d: 12.2, h: 7, z: TOP, color: {color: '#1a1a1a', rough: 0.5}}));
        m.add(kit.box({x: w - 22, y: d - 34, w: 14, d: 30, h: 17, z: TOP, color: {color: '#f2f0ea', rough: 0.5}}));

        // the stepper: can, mounting ears, gear boss and shaft, blue wire box
        const {cx, cy, r, h} = MOTOR;
        g.add(kit.cylinder({cx, cy, r, z0: 0, z1: h, seg: 56, side: {color: '#c6c9cc', rough: 0.3, metal: 0.85}, top: {map: kit.tex.svg('28byj-top', 68, 68, MOTOR_TOP, {ppu: 6, base: '#cfd2d5'}), rough: 0.3, metal: 0.7}}));
        g.add(kit.slab({x: cx - 50, y: cy - 8.5, w: 100, d: 17, h: 1.6, z: h - 1.6, r: 8.4, top: {color: '#c6c9cc', rough: 0.3, metal: 0.85}, side: {color: '#b3b6b9', metal: 0.8}}));
        [-42, 42].forEach(o => g.add(kit.cylinder({cx: cx + o, cy, r: 2.6, z0: h - 1.65, z1: h + 0.05, seg: 16, side: {color: '#0d0f12', rough: 0.6}})));
        g.add(kit.cylinder({cx, cy: cy - 19, r: 11, z0: h, z1: h + 3.6, seg: 32, side: {color: '#c6c9cc', rough: 0.3, metal: 0.85}}));
        g.add(kit.cylinder({cx, cy: cy - 19, r: 3, z0: h + 3.6, z1: h + 27, seg: 20, side: {color: '#e6e8ea', rough: 0.2, metal: 0.9}}));
        g.add(kit.box({x: cx - 17.5, y: cy + r - 6, w: 35, d: 14, h: 40, z: 0, color: {color: '#2557c9', rough: 0.4}}));

        // 5-wire lead from the blue box into the board's socket
        const sx = MX + w - 15;
        const sy = MY + d - 19;
        lead(kit, g, WIRES, k => [
            [cx + (k * 4.6), cy + r + 8, 22],
            [cx + (k * 4.4), cy + r + 26, 2.2],
            [W + 10, sy + 26 + (k * 2.8), 1.3],
            [sx + 12, sy + 20 + (k * 3), 18],
            [sx + 1, sy + (k * 5.6), TOP + 6 + 17]
        ], 1.1);
    }
};
