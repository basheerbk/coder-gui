import {TOP} from '../lib/parts.js';
import {PCB, boardSvg, carrierTraces, pinColumn, screwTerminal, smd, stack, text} from '../lib/breakout.js';

/*
 * DRV8833 dual motor driver: the small red breakout (18.5 × 16 mm, two 6-pin rows) stacked on the
 * purple RJ11 carrier, with screw terminals for motor A, motor B and the motor supply (VM).
 */
const MX = 36;
const MY = 20;
const w = 44;
const d = 38;
const left = pinColumn(6, 3, d / 2);
const right = pinColumn(6, w - 3, d / 2);
const LEFT_NAMES = ['IN1', 'IN2', 'IN3', 'IN4', 'VCC', 'GND'];
const RIGHT_NAMES = ['OUT1', 'OUT2', 'OUT3', 'OUT4', 'VM', 'EEP'];
const TX = MX + w + 14;
const W = TX + 18 + 4;
const H = 84;

const svg = boardSvg({
    w,
    d,
    color: PCB.red[0],
    pins: [...left, ...right],
    extra: LEFT_NAMES.map((n, i) => text(n, 7, left[i].v, {size: 1.6, anchor: 'start'})).join('') +
        RIGHT_NAMES.map((n, i) => text(n, w - 7, right[i].v, {size: 1.6, anchor: 'end'})).join('') +
        text('DRV8833', w / 2, 3.4, {size: 2.2, weight: 700})
});

const CHIP = '<rect width="10" height="7" fill="#1a1b1d"/><circle cx="1.4" cy="1.4" r="0.6" fill="#0a0a0b"/>' +
    '<text x="5" y="4.4" fill="#6c6f75" font-family="Arial, sans-serif" font-size="1.6" text-anchor="middle">8833</text>';

export default {
    id: 'drv8833',
    name: 'Motor Driver DRV8833',
    category: 'output',
    defaultPort: 'STEPPER1',
    spec: {
        w: W,
        h: H,
        jackY: MY + (d / 2),
        label: 'DRV8833',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, 6], [6, H - 6]],
        silk: carrierTraces(left.map(p => [MX + p.u, MY + p.v]), MY + (d / 2), {spread: 1.8, width: 0.9}) +
            text('MOTOR A', TX + 9, 4, {size: 2.4}) + text('VM', TX + 9, H - 3, {size: 2.4}) +
            `<path d="M ${MX + w - 3} ${MY + 6} H ${TX}" stroke="#6531a3" stroke-width="1.4" fill="none"/>` +
            `<path d="M ${MX + w - 3} ${MY + 18} H ${TX}" stroke="#6531a3" stroke-width="1.4" fill="none"/>`
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'drv8833-module', svg, color: PCB.red, pins: [...left, ...right]});
        m.add(kit.box({
            x: 17,
            y: 13,
            w: 10,
            d: 7,
            h: 1.2,
            z: TOP,
            color: {color: '#18191b', rough: 0.45},
            faces: {t: {map: kit.tex.svg('drv8833-chip', 10, 7, CHIP, {ppu: 16, base: '#1a1b1d'}), rough: 0.45}}
        }));
        smd(kit, m, 18, 24, 'C');
        smd(kit, m, 24, 24, 'C');
        smd(kit, m, 18, 7);
        // motor A, motor B and VM screw terminals along the east edge
        screwTerminal(kit, g, {x: TX, y: 7, n: 2, pitch: 12, open: 'e'});
        screwTerminal(kit, g, {x: TX, y: 31, n: 2, pitch: 12, open: 'e'});
        screwTerminal(kit, g, {x: TX, y: 55, n: 2, pitch: 12, open: 'e'});
    }
};
