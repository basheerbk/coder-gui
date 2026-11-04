import {CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3} from 'three';

import {PCB_H} from './board-data.js';
import {at} from './kit.js';
import {BLACK, TOP, axial, glowDecal, passiveTexture, soic, trimmer} from './parts.js';

/*
 * Shared pieces for modules built "the TinkerBit way": a purple RJ11 carrier with a real
 * off-the-shelf breakout stacked on its header (or a part wired to it). Real parts are drawn
 * at about 2.4 units per mm. Coordinates follow the kit: SVG-style x / y (y down), z up.
 */
const MM = 2.4;
const PITCH = 6.1;
const SILK = '#f2f4f6';
const TRACE = '#6531a3';
const PCB = {
    blue: ['#1c5d8f', '#123f63'],
    black: ['#17181a', '#0a0a0b'],
    red: ['#b3262b', '#7d171b'],
    green: ['#1f6b3a', '#134726'],
    purple: ['#4a2178', '#2f1350']
};
const PIN_METAL = {color: '#d6b25a', rough: 0.3, metal: 0.85};
const SOLDER = {color: '#cfd2d5', rough: 0.3, metal: 0.8};

/** n header pins in a column at u, centred on v (module coordinates). */
const pinColumn = (n, u, vMid) => Array.from({length: n}, (_, i) => ({u, v: vMid + ((i - ((n - 1) / 2)) * PITCH)}));

/** n header pins in a row at v, centred on u. */
const pinRow = (n, uMid, v) => Array.from({length: n}, (_, i) => ({u: uMid + ((i - ((n - 1) / 2)) * PITCH), v}));

/** Silver plated hole (mounting or pin pad) as SVG. */
const holeSvg = (x, y, r = 3.4, ring = '#d9dbdd') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ring}"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#0b0f14"/>`;

const text = (t, x, y, {size = 2.4, anchor = 'middle', rot = 0, color = SILK, weight = 400} = {}) => (
    `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" ` +
    `text-anchor="${anchor}" dominant-baseline="middle"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`
);

/** Module top artwork: mask colour, holes, pin pads and any extra markup. */
const boardSvg = ({w, d, color, holes = [], pins = [], extra = ''}) => `<rect width="${w}" height="${d}" fill="${color}"/>` +
    holes.map(([x, y, r]) => holeSvg(x, y, r)).join('') +
    pins.map(p => holeSvg(p.u, p.v, 2.1)).join('') + extra;

/** Carrier copper: one trace per pin from the RJ11 socket (x 26) to the pin's world position. */
const carrierTraces = (points, jackY, {spread = 2.3, width = 1.1} = {}) => points.map(([x, y], i) => {
    const jy = jackY + ((i - ((points.length - 1) / 2)) * spread);
    return `<path d="M 26 ${jy} H 30 L ${Math.max(31, x - 4)} ${y} H ${x}" fill="none" stroke="${TRACE}" stroke-width="${width}" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>';
}).join('');

/** Pin names printed on the carrier, just west of the module. */
const carrierPinNames = (points, names, x) => points.map(([, y], i) => text(names[i], x, y, {size: 2.2, anchor: 'end'})).join('');

/**
 * A breakout standing on its header over the carrier. Adds the black spacer(s) under each pin
 * column or row, then returns a group in the module's own frame — (u, v) from its top-left
 * corner, z = 0 at its underside — so the shared part helpers (which build at z = TOP) sit on
 * its surface. rotate: quarter turns (counter-clockwise seen from above) about the module's corner.
 */
const stack = (kit, g, {x, y, w, d, key, svg, color = PCB.blue, pins = [], spacer = 6, r = 1.5, outline, ppu = 8}) => {
    const columns = {};
    pins.forEach(p => {
        const k = `u${p.u}`;
        (columns[k] = columns[k] || []).push(p);
    });
    const rows = {};
    pins.forEach(p => {
        const k = `v${p.v}`;
        (rows[k] = rows[k] || []).push(p);
    });
    const groups = Object.keys(columns).length <= Object.keys(rows).length ? columns : rows;
    Object.keys(groups).forEach(k => {
        const list = groups[k];
        const u0 = Math.min(...list.map(p => p.u)) - 3;
        const u1 = Math.max(...list.map(p => p.u)) + 3;
        const v0 = Math.min(...list.map(p => p.v)) - 3;
        const v1 = Math.max(...list.map(p => p.v)) + 3;
        g.add(kit.box({x: x + u0, y: y + v0, w: u1 - u0, d: v1 - v0, h: spacer, z: TOP, color: BLACK}));
    });

    const m = new Group();
    const [mx, my] = at(x, y);
    m.position.set(mx, my, TOP + spacer);
    g.add(m);
    m.add(kit.slab({
        x: 0,
        y: 0,
        w,
        d,
        h: PCB_H,
        r,
        outline,
        top: {map: kit.tex.svg(key, w, d, svg, {ppu, base: color[0]}), rough: 0.55},
        side: {color: color[1], rough: 0.6}
    }));
    pins.forEach(p => {
        m.add(kit.cylinder({cx: p.u, cy: p.v, r: 1.5, z0: TOP, z1: TOP + 0.9, side: SOLDER, seg: 14}));
        m.add(kit.box({x: p.u - 0.7, y: p.v - 0.7, w: 1.4, d: 1.4, h: 2.2, z: TOP, color: PIN_METAL, shadow: false}));
    });
    return m;
};

/**
 * Right-angle header on a stacked module's west edge: black support under the edge, the plastic
 * strip on top, and pins running out west then bent down into the carrier at dropX.
 * mx, my: the module's corner on the carrier; vs: pin v positions (module coordinates).
 */
const rightAngleHeader = (kit, g, m, {mx, my, vs, u = 3.2, spacer = 6, dropX = mx - 5}) => {
    const v0 = Math.min(...vs) - 3;
    const span = Math.max(...vs) - Math.min(...vs) + 6;
    const top = TOP + spacer + PCB_H;
    g.add(kit.box({x: mx, y: my + v0, w: 6, d: span, h: spacer, z: TOP, color: BLACK}));
    m.add(kit.box({x: u - 2.4, y: v0, w: 5, d: span, h: 2.6, z: TOP, color: {color: '#151515', rough: 0.5}}));
    vs.forEach(v => {
        m.add(kit.cylinder({cx: u, cy: v, r: 1.4, z0: TOP, z1: TOP + 0.6, side: SOLDER, seg: 12}));
        g.add(kit.box({x: dropX - 0.7, y: my + v - 0.7, w: mx + u - dropX + 1.4, d: 1.4, h: 1.4, z: top + 0.6, color: PIN_METAL}));
        g.add(kit.box({x: dropX - 0.7, y: my + v - 0.7, w: 1.4, d: 1.4, h: top + 3.2 - TOP, z: TOP - 1.2, color: PIN_METAL}));
    });
    return dropX;
};

/** Small 0805 resistor or capacitor at (x, y), its long side along x unless vertical. */
const smd = (kit, g, x, y, kind = 'R', vertical = false) => g.add(kit.box({
    x,
    y,
    w: vertical ? 2.2 : 4.4,
    d: vertical ? 4.4 : 2.2,
    h: kind === 'C' ? 1.4 : 1.1,
    z: TOP,
    color: kind === 'C' ? '#8a6641' : '#121212',
    faces: {t: {map: passiveTexture(kit, kind === 'C' ? 'C' : 'R', !vertical), rough: 0.45}}
}));

/** 0805 indicator LED; lit ones get a soft glow. */
const ledSmd = (kit, g, x, y, color, lit = true) => {
    g.add(kit.box({x, y, w: 4.4, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color})}}));
    if (lit) {
        g.add(glowDecal(kit, {cx: x + 2.2, cy: y + 1.2, size: 14, z: TOP + 1.3, color, opacity: 0.55}));
    }
};

/** Profile of a 5 mm through-hole LED (radius, height) in units, flange at 0. */
const LED5 = [[0, 0], [6.6, 0], [6.6, 1.4], [6, 1.4], [6, 10.5], [5.6, 11.8], [4.6, 12.9], [3, 13.6], [0, 13.9]];

/**
 * 5 mm LED. dir 'up': standing on legs from z0 (default TOP) with its flange at z0 + legs.
 * dir 'e' / 'w': lying with its dome pointing east / west, centre height cz.
 */
const led5 = (kit, g, {x, y, dir = 'up', z0 = TOP, legs = 4, cz, color = '#d8e4ee', opacity = 0.65, key = 'led5', lit = false}) => {
    const material = {color, rough: 0.18, opacity, emissive: lit ? color : '#000000', emissiveIntensity: lit ? 0.5 : 0};
    const mesh = kit.lathe({key, cx: 0, cy: 0, z: 0, profile: LED5, material});
    if (dir === 'up') {
        mesh.position.set(...at(x, y), z0 + legs);
        g.add(mesh);
        [-1.3, 1.3].forEach(o => g.add(kit.box({x: x + o - 0.4, y: y - 0.4, w: 0.8, d: 0.8, h: legs, z: z0, color: SOLDER, shadow: false})));
    } else {
        const s = dir === 'e' ? 1 : -1;
        mesh.rotation.y = s * (Math.PI / 2);
        mesh.position.set(...at(x, y), cz);
        g.add(mesh);
        // legs: back along the body, then down to the board
        [-1.3, 1.3].forEach(o => {
            g.add(kit.box({x: s > 0 ? x - 6 : x, y: y + o - 0.4, w: 6, d: 0.8, h: 0.8, z: cz - 0.4, color: SOLDER, shadow: false}));
            g.add(kit.box({x: x - (s * 6) - 0.4, y: y + o - 0.4, w: 0.8, d: 0.8, h: cz - z0, z: z0, color: SOLDER, shadow: false}));
        });
    }
    if (lit) {
        g.add(glowDecal(kit, {cx: x, cy: y, size: 34, z: z0 + 0.3, color, opacity: 0.45}));
    }
    return mesh;
};

/**
 * Green pluggable screw terminal: n poles along y at `pitch`, footprint x .. x + 18, with the
 * wire openings facing `open` ('e' or 'w') and the screws on top.
 */
const screwTerminal = (kit, g, {x, y, n = 2, pitch = 12, open = 'e', z = TOP}) => {
    const d = n * pitch;
    const top = `<rect width="18" height="${d}" fill="#1f8a4c"/>` + Array.from({length: n}, (_, i) => {
        const cy = (i + 0.5) * pitch;
        return `<circle cx="9" cy="${cy}" r="4.2" fill="#c9ccce"/><circle cx="9" cy="${cy}" r="3.4" fill="#a9adb1"/>` +
            `<path d="M 6.4 ${cy} H 11.6" stroke="#55595e" stroke-width="1.1"/>` +
            `<line x1="0" y1="${i * pitch}" x2="18" y2="${i * pitch}" stroke="#176c3b" stroke-width="0.6"/>`;
    }).join('');
    const face = `<rect width="${d}" height="22" fill="#1f8a4c"/>` + Array.from({length: n}, (_, i) => (
        `<rect x="${(i * pitch) + 2.5}" y="9" width="${pitch - 5}" height="7" rx="1" fill="#0d1a12"/>` +
        `<rect x="${(i * pitch) + 3.5}" y="10" width="${pitch - 7}" height="5" fill="#9aa0a5"/>`
    )).join('');
    g.add(kit.box({
        x,
        y,
        w: 18,
        d,
        h: 22,
        z,
        color: {color: '#1d8048', rough: 0.55},
        faces: {t: {map: kit.tex.svg(`screwterm-top:${n}:${pitch}`, 18, d, top, {ppu: 8, base: '#1f8a4c'}), rough: 0.5}}
    }));
    g.add(kit.sideDecal({
        face: open,
        x,
        y,
        w: 18,
        d,
        z,
        h: 22,
        material: {map: kit.tex.svg(`screwterm-face:${n}:${pitch}`, d, 22, face, {ppu: 8, base: '#1f8a4c'}), rough: 0.5}
    }));
};

/** One insulated wire as a tube through SVG-style [x, y, z] points. */
const wire = (kit, points, color, r = 1.3) => {
    const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, -y, z)), false, 'centripetal');
    const mesh = new Mesh(new TubeGeometry(curve, Math.max(24, points.length * 16), r, 8, false), kit.mat({color, rough: 0.5}));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

/** Several wires side by side: paths(k) gives the points for the wire at offset index k. */
const lead = (kit, g, colors, paths, r = 1.3) => colors.forEach((c, i) => g.add(wire(kit, paths(i - ((colors.length - 1) / 2), i), c, r)));

/**
 * A generic LM393 comparator sensor board (the common 32 × 14 mm blue module): header on the
 * west edge, comparator, sensitivity trimmer, PWR and signal LEDs, and a sensor area to the east
 * that `sensor(kit, m, ctx)` fills. Returns a full component definition on a purple carrier.
 */
const comparatorModule = ({id, name, category = 'sensor', defaultPort = 'A1', label, pinNames, color = PCB.blue,
    w = 77, d = 34, sensor, silk = '', overhang = 0, extraBuild}) => {
    const MX = 36;
    const MY = 5;
    const pins = pinColumn(pinNames.length, 3, d / 2);
    const W = MX + w - overhang + 5;
    const H = MY + d + 13;
    const world = pins.map(p => [MX + p.u, MY + p.v]);
    const svg = boardSvg({
        w,
        d,
        color: color[0],
        holes: [[38, d / 2, 3.4]],
        pins,
        extra: text('PWR', 30, 4.5, {size: 2}) + text('DO', 30, d - 4, {size: 2}) + silk
    });
    return {
        id,
        name,
        category,
        defaultPort,
        spec: {
            w: W,
            h: H,
            jackY: MY + (d / 2),
            label,
            labelAt: [MX + ((w - overhang) / 2), H - 5],
            labelSize: 3.6,
            holes: [[6, H - 6]],
            silk: carrierTraces(world, MY + (d / 2)) + carrierPinNames(world, pinNames, MX - 1.5)
        },
        build (kit, g, ctx) {
            const m = stack(kit, g, {x: MX, y: MY, w, d, key: `${id}-module`, svg, color, pins});
            soic(kit, m, {x: 9, y: 3.4, w: 10, d: 8});
            trimmer(kit, m, 9, 20);
            ledSmd(kit, m, 23, 7, '#ff3030');
            ledSmd(kit, m, 23, d - 9.5, '#30ff60', false);
            smd(kit, m, 23, 13);
            smd(kit, m, 23, 18.5, 'C');
            sensor(kit, m, {...ctx, w, d});
            if (extraBuild) {
                extraBuild(kit, g, {...ctx, MX, MY, W, H});
            }
        }
    };
};

export {
    MM,
    PITCH,
    SILK,
    TRACE,
    PCB,
    PIN_METAL,
    SOLDER,
    pinColumn,
    pinRow,
    holeSvg,
    text,
    boardSvg,
    carrierTraces,
    carrierPinNames,
    stack,
    rightAngleHeader,
    smd,
    ledSmd,
    led5,
    screwTerminal,
    wire,
    lead,
    axial,
    comparatorModule
};
