import {LatheGeometry, Mesh, Vector2} from 'three';

import {at} from '../lib/kit.js';
import {TOP} from '../lib/parts.js';
import {PCB, boardSvg, carrierPinNames, carrierTraces, pinColumn, stack} from '../lib/breakout.js';

/*
 * PIR motion sensor (HC-SR501, green 32 × 24 mm): the white Fresnel dome on its square base on top;
 * the BISS0001, trimmers and header sit underneath. Header pins face the RJ11 socket.
 */
const MX = 36;
const MY = 5;
const w = 77;
const d = 58;
const pins = pinColumn(3, 3, d / 2);
const names = ['VCC', 'OUT', 'GND'];
const world = pins.map(p => [MX + p.u, MY + p.v]);
const W = MX + w + 5;
const H = MY + d + 12;
const CX = 42;
const CY = d / 2;
const R = 27.6;

const svg = boardSvg({w, d, color: PCB.green[0], holes: [[4.5, 4.5, 2.6], [w - 4.5, d - 4.5, 2.6]], pins});

/**
 * Honeycomb Fresnel lens: hexagonal lens cells drawn in a top view of the dome (2R square), each
 * shaded bright in the middle and outlined, the way the HC-SR501 lens looks from above.
 */
const honeycomb = kit => kit.tex.canvas('pir-honeycomb', 2 * R, 2 * R, (ctx, cw) => {
    const s = cw / (2 * R);
    const cell = 3.4 * s;
    const hw = Math.sqrt(3) * cell;
    ctx.fillStyle = '#e9e9e3';
    ctx.fillRect(0, 0, cw, cw);
    const hex = (cx, cy, r) => {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + (Math.PI / 6);
            ctx[k ? 'lineTo' : 'moveTo'](cx + (r * Math.cos(a)), cy + (r * Math.sin(a)));
        }
        ctx.closePath();
    };
    for (let row = -1; row * cell * 1.5 < cw + cell; row++) {
        const cy = row * cell * 1.5;
        for (let col = -1; col * hw < cw + hw; col++) {
            const cx = (col * hw) + (row % 2 ? hw / 2 : 0);
            const g = ctx.createRadialGradient(cx - (cell * 0.25), cy - (cell * 0.3), cell * 0.05, cx, cy, cell);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.55, '#f4f4ef');
            g.addColorStop(1, '#d6d6cf');
            hex(cx, cy, cell * 0.97);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.lineWidth = Math.max(1, s * 0.35);
            ctx.strokeStyle = 'rgba(140, 140, 130, 0.75)';
            ctx.stroke();
        }
    }
}, {ppu: 14});

/** The dome as a lathe whose texture is projected straight down, so the cells read evenly from above. */
const dome = kit => kit.geo('pir-dome-honeycomb', () => {
    const geo = new LatheGeometry(DOME.map(([r, h]) => new Vector2(r, h)), 48);
    geo.rotateX(Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) / (2 * R)) + 0.5, (pos.getY(i) / (2 * R)) + 0.5);
    }
    return geo;
});

/** Dome profile: a short skirt, then a slightly flattened hemisphere of Fresnel facets. */
const DOME = (() => {
    const p = [[0, 0], [R, 0], [R, 3]];
    for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        p.push([R * Math.cos(a), 3 + (24 * Math.sin(a))]);
    }
    return p;
})();

export default {
    id: 'pir',
    name: 'PIR Motion Sensor',
    category: 'sensor',
    defaultPort: 'J0',
    spec: {
        w: W,
        h: H,
        jackY: MY + (d / 2),
        label: 'PIR MOTION',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(world, MY + (d / 2)) + carrierPinNames(world, names, MX - 1.5)
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'pir-module', svg, color: PCB.green, pins, spacer: 9});
        // square lens frame, then the dome (segmented rings read as the Fresnel facets)
        m.add(kit.slab({x: CX - 29, y: CY - 29, w: 58, d: 58, h: 4, z: TOP, r: 3, top: {color: '#f1f1ec', rough: 0.6}, side: {color: '#e4e4de', rough: 0.6}}));
        const lens = new Mesh(dome(kit), kit.mat({map: honeycomb(kit), rough: 0.5}));
        lens.position.set(...at(CX, CY), TOP + 4);
        lens.castShadow = true;
        lens.receiveShadow = true;
        m.add(lens);
        // two orange adjustment pots and the jumper under the board
        [[50, 14], [50, 40]].forEach(([u, v]) => m.add(kit.box({x: u, y: v - 4, w: 8, d: 8, h: 4.5, z: -4.5, color: {color: '#e07a1f', rough: 0.5}})));
        m.add(kit.box({x: 64, y: 22, w: 5, d: 12, h: 5, z: -5, color: {color: '#1a1a1a', rough: 0.5}}));
    }
};
