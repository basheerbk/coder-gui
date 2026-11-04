import {TOP} from '../lib/parts.js';
import {PCB, boardSvg, carrierTraces, lead, pinColumn, screwTerminal, smd, stack, text} from '../lib/breakout.js';

/*
 * I²S amplifier MAX98357A (blue 18 × 19 mm breakout, 7 pins, speaker screw terminal) stacked on
 * the purple RJ11 carrier, wired to a 40 mm 8 Ω speaker lying cone-up on the table.
 */
const MX = 36;
const MY = 5;
const w = 46;
const d = 48;
const pins = pinColumn(7, 3, d / 2);
const names = ['LRC', 'BCLK', 'DIN', 'GAIN', 'SD', 'GND', 'VIN'];
const W = MX + w + 6;
const H = MY + d + 12;
const SPK = {cx: W + 70, cy: H / 2, r: 48};

const svg = boardSvg({
    w,
    d,
    color: PCB.purple[0],
    pins,
    extra: names.map((n, i) => text(n, 7.4, pins[i].v, {size: 1.8, anchor: 'start'})).join('') +
        text('MAX98357A', 24, 4, {size: 2.2, weight: 700}) + text('+', 30, 14, {size: 3}) + text('-', 30, 34, {size: 3})
});

const CHIP = '<rect width="7" height="7" fill="#1a1b1d"/><circle cx="1.2" cy="1.2" r="0.5" fill="#0a0a0b"/>';

/** Cone profile (radius, height) from the dust cap out to the surround. */
const CONE = [[0, 7], [8, 7], [9, 5.6], [40, 12], [44, 12.6], [46, 12]];

export default {
    id: 'i2samp',
    name: 'I²S Amp MAX98357A + Speaker',
    category: 'output',
    defaultPort: 'UART1',
    spec: {
        w: W,
        h: H,
        jackY: MY + (d / 2),
        label: 'I2S AMP',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(pins.map(p => [MX + p.u, MY + p.v]), MY + (d / 2), {spread: 1.6, width: 0.9})
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'max98357-module', svg, color: PCB.purple, pins});
        m.add(kit.box({x: 18, y: 20, w: 7, d: 7, h: 1, z: TOP, color: {color: '#18191b', rough: 0.45}, faces: {t: {map: kit.tex.svg('max98357-chip', 7, 7, CHIP, {ppu: 16, base: '#1a1b1d'}), rough: 0.45}}}));
        smd(kit, m, 18, 10, 'C');
        smd(kit, m, 18, 32, 'C');
        smd(kit, m, 18, 38);
        screwTerminal(kit, m, {x: w - 18, y: 10, n: 2, pitch: 8.4, open: 'e'});

        // speaker: magnet underneath, steel frame, paper cone and dust cap, two solder tabs
        const {cx, cy, r} = SPK;
        g.add(kit.cylinder({cx, cy, r: 22, z0: 0, z1: 14, seg: 40, side: {color: '#2a2b2e', rough: 0.4, metal: 0.6}}));
        g.add(kit.cylinder({cx, cy, r, z0: 14, z1: 17, seg: 64, side: {color: '#202124', rough: 0.45, metal: 0.4}, top: {color: '#26272a', rough: 0.5}}));
        g.add(kit.lathe({key: 'speaker-cone', cx, cy, z: 14, profile: CONE, seg: 56, material: {color: '#1c1c1e', rough: 0.85}}));
        g.add(kit.cylinder({cx, cy, r: 9, z0: 19.4, z1: 22, r1: 6, seg: 32, side: {color: '#111113', rough: 0.6}, top: {color: '#111113', rough: 0.6}}));
        [-1, 1].forEach(k => g.add(kit.box({x: cx - r - 6, y: cy + (k * 8) - 2, w: 8, d: 4, h: 0.6, z: 16, color: {color: '#d4d6d8', metal: 0.8, rough: 0.3}})));
        lead(kit, g, ['#d0302a', '#151515'], k => [
            [MX + w + 1, MY + 14.2 + ((k + 0.5) * 8.4), TOP + 6 + 10],
            [MX + w + 10, MY + 18 + (k * 4), 8],
            [cx - r - 20, cy + (k * 6), 1.3],
            [cx - r - 4, cy + (k * 8), 16.4]
        ], 1.2);
    }
};
