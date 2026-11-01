import {Group} from 'three';

import {JACK, PCB_H, STUB} from './board-data.js';
import {at} from './kit.js';
import {buildJack} from './parts.js';

const SILK_FONT = '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
const SOCKET_COLOR = '#8d9093';
/** House style: every TinkerBit module uses the same purple PCB (override per call with options.pcb / options.edge). */
const PCB_COLOR = '#552a8a';
const PCB_EDGE = '#341656';
const ROTATION_BY_SIDE = {top: -90, bottom: 90, right: 0, left: 180};

const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The board's label; a "\n" in it starts a new line (lines are centred on labelAt). */
const labelSvg = spec => {
    const size = spec.labelSize || 5.5;
    const lines = String(spec.label).split('\n');
    const lead = size * 1.25;
    const y0 = spec.labelAt[1] - (((lines.length - 1) * lead) / 2);
    return lines.map((line, i) => (
        `<text x="${spec.labelAt[0]}" y="${y0 + (i * lead)}" fill="#f4f4f0" font-family='${SILK_FONT}' font-weight="700" ` +
        `font-size="${size}" letter-spacing="0.4" text-anchor="middle" dominant-baseline="middle">${escapeText(line)}</text>`
    )).join('');
};

/** PCB top: optional silkscreen, two mounting holes on the far edge and the board's label. */
const pcbTopSvg = spec => {
    const holes = (spec.holes || [[spec.w - 6, 6], [spec.w - 6, spec.h - 6]]).map(([hx, hy]) => (
        `<circle cx="${hx}" cy="${hy}" r="3.2" fill="#c9b27a"/><circle cx="${hx}" cy="${hy}" r="1.8" fill="#141414"/>`
    )).join('');
    return `<rect width="${spec.w}" height="${spec.h}" fill="${spec.pcb}"/>` +
        `<svg viewBox="0 0 ${spec.w} ${spec.h}" preserveAspectRatio="none">${spec.silk || ''}${holes}` +
        `${labelSvg(spec)}</svg>`;
};

/** A component's spec with any caller overrides (pcb, edge, label, labelSize) applied. */
const resolveSpec = (spec, options = {}) => {
    const out = {pcb: PCB_COLOR, edge: PCB_EDGE, ...spec};
    ['pcb', 'edge', 'label', 'labelSize'].forEach(key => {
        if (options[key] !== undefined && options[key] !== null) {
            out[key] = options[key];
        }
    });
    return out;
};

/**
 * A module board: PCB slab, grey RJ11 socket on the west edge at jackY, then the component's own
 * parts. Returns a group with the PCB centred on the origin and its underside at z = 0 (board space).
 */
const buildModule = (kit, component, options = {}) => {
    const spec = resolveSpec(component.spec, options);
    const outer = new Group();
    outer.name = component.id;

    const g = new Group();
    const [ox, oy] = at(-spec.w / 2, -spec.h / 2);
    g.position.set(ox, oy, 0);
    outer.add(g);

    const key = ['pcb', component.id, spec.pcb, spec.label, spec.labelSize || ''].join(':');
    g.add(kit.slab({
        x: 0,
        y: 0,
        w: spec.w,
        d: spec.h,
        h: PCB_H,
        r: 2,
        outline: spec.outline,
        top: {map: kit.tex.svg(key, spec.w, spec.h, pcbTopSvg(spec), {ppu: 6, base: spec.pcb}), rough: 0.6},
        side: {color: spec.edge, rough: 0.7}
    }));

    const socket = buildJack(kit, {color: SOCKET_COLOR});
    const [sx, sy] = at(-2 + (JACK.w / 2), spec.jackY);
    socket.position.set(sx, sy, PCB_H);
    g.add(socket);

    component.build(kit, g, {spec, options});
    outer.userData.spec = spec;
    return outer;
};

/**
 * Places a module of w × h world units, socket on its left edge at jackY, so the socket faces
 * the board jack, then applies a drag offset. Returns the centre, rotation (degrees, clockwise
 * in SVG space), rotated bounding box and the world point of the socket.
 */
const placeModule = ({w, h, jackY: socketY}, port, offsetX = 0, offsetY = 0) => {
    const pos = port.pos;
    const rotation = ROTATION_BY_SIDE[port.side] || 0;
    const reach = STUB + (w / 2);
    let cx = pos.cableX;
    let cy = pos.cableY;
    if (port.side === 'top') {
        cy -= reach;
    } else if (port.side === 'bottom') {
        cy += reach;
    } else if (port.side === 'left') {
        cx -= reach;
    } else {
        cx += reach;
    }
    cx += offsetX;
    cy += offsetY;

    const localX = -w / 2;
    const localY = socketY - (h / 2);
    const rad = rotation * (Math.PI / 180);
    const jackX = cx + (localX * Math.cos(rad)) - (localY * Math.sin(rad));
    const jackY = cy + (localX * Math.sin(rad)) + (localY * Math.cos(rad));
    const upright = rotation === 0 || rotation === 180;
    return {
        cx,
        cy,
        w,
        h,
        rotation,
        boxW: upright ? w : h,
        boxH: upright ? h : w,
        jack: {x: jackX, y: jackY}
    };
};

export {PCB_COLOR, PCB_EDGE, SILK_FONT, pcbTopSvg, resolveSpec, buildModule, placeModule};
