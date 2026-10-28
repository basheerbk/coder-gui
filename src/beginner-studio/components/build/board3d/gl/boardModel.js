import React from 'react';
import {Group, Mesh, MeshBasicMaterial, AdditiveBlending} from 'three';

import {
    BUTTONS,
    LEDS,
    MOD,
    MODULE_PADS,
    PASSIVES,
    ROUTES,
    U1,
    U4,
    USB,
    jackInnerPoint,
    padY,
    passiveSize
} from '../../../../domain/boardLayout';
import {BOARD, JACK, PORTS, portColor, portPosition} from '../../../../domain/ports';
import {BoardDefs, BoardSurface} from '../../BoardArt.jsx';
import {SceneDefs} from '../../ConnectionsLayer.jsx';
import {PortLabel, labelAnchor} from '../../Port.jsx';
import {JACK_H, OPEN, JackFront, JackTop, jackFootprint} from '../Jack3D.jsx';
import {CAN, CAN_H, CanTop, ChipLegs, GOLD, MOD_H, ModuleTop, USB_H, UsbFront, UsbTop, chipTop} from '../Parts3D.jsx';

import {at} from './kit';

const SLAB_T = 7;
const TABLE_Z = -SLAB_T;
const JACK_R = 3.5;
const OPEN_ROT = {W: 0, E: Math.PI, N: -Math.PI / 2, S: Math.PI / 2};
const BLACK = {color: '#151617', rough: 0.45};
const METAL = {color: '#c9ccce', rough: 0.32, metal: 0.85};

/** Soft round glow, white so a material colour can tint it. */
const glowTexture = kit => kit.tex.canvas('glow', 16, 16, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}, {ppu: 8});

/** A glow decal with its own material so its opacity can animate. */
const glowDecal = (kit, {cx, cy, size, z, color, opacity = 0.9}) => {
    const material = new MeshBasicMaterial({
        color,
        map: glowTexture(kit),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false
    });
    return kit.decal({x: cx - (size / 2), y: cy - (size / 2), w: size, d: size, z, material, receive: false});
};

/** Two-tone SMD top: metal end caps around a body. */
const passiveTexture = (kit, kind, horizontal) => kit.tex.canvas(`passive:${kind}:${horizontal ? 'h' : 'v'}`, 12, 12, (ctx, w, h) => {
    ctx.fillStyle = kind === 'C' ? '#b08657' : '#161616';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d2d3d0';
    if (horizontal) {
        ctx.fillRect(0, 0, w * 0.22, h);
        ctx.fillRect(w * 0.78, 0, w * 0.22, h);
    } else {
        ctx.fillRect(0, 0, w, h * 0.22);
        ctx.fillRect(0, h * 0.78, w, h * 0.22);
    }
});

/** Gold half-holes along a module edge, left to right in image space. */
const castTexture = (kit, key, len, positions) => kit.tex.canvas(`cast:${key}`, len, MOD_H, (ctx, w, h) => {
    const s = w / len;
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = GOLD;
    positions.forEach(p => ctx.fillRect((p - 2) * s, 0, 4 * s, h));
}, {ppu: 8});

/** Unshared copy of a cached material, freed with the mesh that owns it. */
const ownCopy = m => {
    const copy = m.clone();
    copy.userData.shared = false;
    return copy;
};

const withBoardDefs = content => (
    <g>
        <BoardDefs />
        {content}
    </g>
);

/**
 * RJ11 housing in its own frame: mouth on the west face, D deep (x) by Wd across (y), centred on
 * the origin. Board jacks and module sockets are the same part.
 */
const buildJack = (kit, {color, D = JACK.w, Wd = JACK.h}) => {
    const group = new Group();
    const top = kit.tex.svg(`jack-top:${color}:${D}:${Wd}`, D, Wd, (
        <g>
            <defs>
                <linearGradient id="jt" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2c2c2c" />
                    <stop offset="100%" stopColor="#0c0c0c" />
                </linearGradient>
            </defs>
            <rect width={D} height={Wd} fill="url(#jt)" />
            <JackTop D={D} Wd={Wd} color={color} />
        </g>
    ), {ppu: 8, base: '#161616'});
    const housing = kit.slab({
        x: -D / 2,
        y: -Wd / 2,
        w: D,
        d: Wd,
        h: JACK_H,
        r: JACK_R,
        top: {map: top, rough: 0.5},
        side: {color: '#141414', rough: 0.5}
    });
    group.add(housing);

    const span = Wd * 0.84;
    const mouth = kit.tex.svg(`jack-mouth:${Wd}`, span, JACK_H, (
        <g>
            <rect width={span} height={JACK_H} fill="#161616" />
            <g transform={`translate(${-(Wd - span) / 2}, 0)`}>
                <JackFront Wd={Wd} H={JACK_H} />
            </g>
        </g>
    ), {ppu: 8, base: '#161616'});
    group.add(kit.sideDecal({
        face: 'w',
        x: -D / 2,
        y: -Wd / 2,
        w: D,
        d: Wd,
        z: 0,
        h: JACK_H,
        span,
        material: {map: mouth, rough: 0.5}
    }));
    group.userData.housing = housing;
    return group;
};

/** Board jacks with highlight ring, glow and label; state is applied later by the controller. */
const buildPorts = (kit, K) => PORTS.map(port => {
    const color = portColor(port, K);
    const fp = jackFootprint(port);
    const open = OPEN[port.side] || 'W';
    const jack = buildJack(kit, {color});
    const [cx, cy] = at(fp.x + (fp.w / 2), fp.y + (fp.d / 2));
    jack.position.set(cx, cy, 0);
    jack.rotation.z = OPEN_ROT[open];

    // Per-jack materials so dimming one jack doesn't dim them all
    jack.traverse(obj => {
        if (obj.isMesh) {
            obj.material = Array.isArray(obj.material) ? obj.material.map(ownCopy) : ownCopy(obj.material);
            obj.userData.portId = port.id;
        }
    });

    const ring = new Mesh(
        kit.ring({w: JACK.w, d: JACK.h, r: JACK_R, width: 1.8}),
        new MeshBasicMaterial({color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false})
    );
    ring.position.z = JACK_H + 0.08;
    ring.renderOrder = 2;
    jack.add(ring);

    const glow = glowDecal(kit, {cx: 0, cy: 0, size: JACK.h + 34, z: JACK_H + 0.05, color, opacity: 0});
    glow.position.set(0, 0, JACK_H + 0.05);
    glow.renderOrder = 1;
    jack.add(glow);

    const pos = portPosition(port);
    const anchor = labelAnchor(port.side, pos.x, pos.y);
    const chipW = Math.max(32, (String(port.label).length * 8) + 14);
    let chipX = anchor.x - 2;
    if (anchor.anchor === 'middle') {
        chipX = anchor.x - (chipW / 2);
    } else if (anchor.anchor === 'end') {
        chipX = anchor.x - chipW + 2;
    }
    const box = {x: chipX - 5, y: anchor.y - 17, w: chipW + 10, d: 27};
    const labelTex = kit.tex.svg(`label:${port.id}:${color}:${K.panel}`, box.w, box.d, (
        <g transform={`translate(${-box.x}, ${-box.y})`}>
            <SceneDefs />
            <PortLabel port={port} x={pos.x} y={pos.y} color={color} K={K} />
        </g>
    ), {ppu: 6});
    const label = kit.decal({
        ...box,
        z: 0.12,
        material: new MeshBasicMaterial({map: labelTex, transparent: true, depthWrite: false, toneMapped: false}),
        receive: false
    });
    label.renderOrder = 1;

    return {port, jack, ring, glow, label, color};
});

/** Rounded polyline (same corners as boardLayout's roundedPath), densely sampled. */
const roundedPoints = (pts, radius = 6, steps = 6) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const [cx, cy] = pts[i + 1];
        const l1 = Math.hypot(bx - ax, by - ay) || 1;
        const l2 = Math.hypot(cx - bx, cy - by) || 1;
        const r = Math.min(radius, l1 / 2, l2 / 2);
        const p0 = [bx - ((bx - ax) / l1 * r), by - ((by - ay) / l1 * r)];
        const p2 = [bx + ((cx - bx) / l2 * r), by + ((cy - by) / l2 * r)];
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const u = 1 - t;
            out.push([
                (u * u * p0[0]) + (2 * u * t * bx) + (t * t * p2[0]),
                (u * u * p0[1]) + (2 * u * t * by) + (t * t * p2[1])
            ]);
        }
    }
    out.push(pts[pts.length - 1]);
    return out;
};

/** portId → sampled copper route in world units, from the jack to the ESP32 pad. */
const TRACE_POINTS = PORTS.reduce((all, port) => {
    if (ROUTES[port.id]) {
        all[port.id] = roundedPoints(ROUTES[port.id](jackInnerPoint(port)))
            .map(([x, y]) => [x + BOARD.x, y + BOARD.y]);
    }
    return all;
}, {});

/** The board slab and everything soldered to it, in a group placed at the board's corner. */
const buildBoard = kit => {
    const group = new Group();
    const [bx, by] = at(BOARD.x, BOARD.y);
    group.position.set(bx, by, 0);

    const surface = kit.tex.svg('board-top', BOARD.w, BOARD.h, withBoardDefs(
        <g>
            <BoardSurface connected={{}} />
            <ChipLegs />
        </g>
    ), {ppu: 4, base: '#f4f4f0'});
    group.add(kit.slab({
        x: 0,
        y: 0,
        w: BOARD.w,
        d: BOARD.h,
        h: SLAB_T,
        z: -SLAB_T,
        r: 10,
        top: {map: surface, rough: 0.72},
        side: {color: '#d9cfa8', rough: 0.8}
    }));

    // ESP32 module: black PCB with castellations, then the shield can
    group.add(kit.box({
        x: MOD.x,
        y: MOD.y,
        w: MOD.w,
        d: MOD.h,
        h: MOD_H,
        color: {color: '#151515', rough: 0.5},
        faces: {t: {map: kit.tex.svg('esp-top', MOD.w, MOD.h, <ModuleTop />, {ppu: 6, base: '#141414'}), rough: 0.5}}
    }));
    const castX = Array.from({length: MODULE_PADS}, (_, k) => 10 + (k * 10));
    const castY = Array.from({length: MODULE_PADS}, (_, k) => padY(k) - MOD.y);
    const modBox = {x: MOD.x, y: MOD.y, w: MOD.w, d: MOD.h, z: 0, h: MOD_H};
    group.add(kit.sideDecal({...modBox, face: 's', material: {map: castTexture(kit, 's', MOD.w, castX), rough: 0.4}}));
    group.add(kit.sideDecal({...modBox, face: 'w', material: {map: castTexture(kit, 'w', MOD.h, castY), rough: 0.4}}));
    group.add(kit.sideDecal({
        ...modBox,
        face: 'e',
        material: {map: castTexture(kit, 'e', MOD.h, castY.map(p => MOD.h - p)), rough: 0.4}
    }));
    group.add(kit.box({
        x: CAN.x,
        y: CAN.y,
        w: CAN.w,
        d: CAN.d,
        h: CAN_H,
        z: MOD_H,
        color: {color: '#bdb8ac', rough: 0.35, metal: 0.75},
        faces: {t: {map: kit.tex.svg('esp-can', CAN.w, CAN.d, withBoardDefs(<CanTop />), {ppu: 6, base: '#c9c4b8'}), rough: 0.38, metal: 0.55}}
    }));

    PASSIVES.forEach(([px, py, kind, horizontal]) => {
        const {w, h} = passiveSize(horizontal);
        const side = kind === 'C' ? '#8a6641' : '#121212';
        group.add(kit.box({
            x: px - (w / 2),
            y: py - (h / 2),
            w,
            d: h,
            h: kind === 'C' ? 3.2 : 2.4,
            color: side,
            faces: {t: {map: passiveTexture(kit, kind, horizontal), rough: 0.45}}
        }));
    });

    group.add(kit.box({...U1.tab, d: U1.tab.h, h: 1.6, color: METAL}));
    group.add(kit.box({
        ...U1.body,
        d: U1.body.h,
        h: 5,
        color: BLACK,
        faces: {t: {map: kit.tex.svg('u1-top', U1.body.w, U1.body.h, chipTop(U1.body.w, U1.body.h), {ppu: 6, base: '#1a1b1d'}), rough: 0.45}}
    }));
    group.add(kit.box({
        ...U4.body,
        d: U4.body.h,
        h: 4,
        color: BLACK,
        faces: {
            t: {
                map: kit.tex.svg(
                    'u4-top',
                    U4.body.w,
                    U4.body.h,
                    chipTop(U4.body.w, U4.body.h, {x: U4.dot.x - U4.body.x, y: U4.dot.y - U4.body.y}),
                    {ppu: 6, base: '#1a1b1d'}
                ),
                rough: 0.45
            }
        }
    }));

    const leds = LEDS.map(led => {
        group.add(kit.box({x: led.x - 3.5, y: led.y - 5, w: 7, d: 10, h: 2.5, color: {color: '#ece9e0', rough: 0.4}}));
        const dot = kit.cylinder({
            cx: led.x,
            cy: led.y,
            r: 2.2,
            z0: 2.5,
            z1: 2.9,
            side: kit.basic({color: led.color}),
            seg: 20
        });
        dot.castShadow = false;
        group.add(dot);
        const glow = glowDecal(kit, {cx: led.x, cy: led.y, size: 26, z: 3, color: led.color});
        group.add(glow);
        return {mode: led.mode, glow};
    });

    BUTTONS.forEach(b => {
        group.add(kit.box({
            x: b.x - 9,
            y: b.y - 7,
            w: 18,
            d: 14,
            h: 4,
            color: {color: '#a7a9ab', rough: 0.35, metal: 0.6}
        }));
        group.add(kit.cylinder({
            cx: b.x,
            cy: b.y,
            r: 4.6,
            z0: 4,
            z1: 6.4,
            side: {color: '#3d2e27', rough: 0.55},
            top: {color: '#5a463c', rough: 0.5},
            seg: 24
        }));
    });

    const usbBox = {x: USB.x, y: USB.y, w: USB.w, d: USB.h, h: USB_H, z: 0};
    group.add(kit.box({
        ...usbBox,
        color: {color: '#b8babc', rough: 0.3, metal: 0.85},
        faces: {t: {map: kit.tex.svg('usb-top', USB.w, USB.h, withBoardDefs(<UsbTop />), {ppu: 6, base: '#c9cbcd'}), rough: 0.3, metal: 0.7}}
    }));
    group.add(kit.sideDecal({
        ...usbBox,
        face: 's',
        material: {map: kit.tex.svg('usb-front', USB.w, USB_H, <UsbFront />, {ppu: 8, base: '#c9cbcd'}), rough: 0.35, metal: 0.5}
    }));

    return {group, leds};
};

export {SLAB_T, TABLE_Z, TRACE_POINTS, buildBoard, buildJack, buildPorts, glowDecal, glowTexture, passiveTexture};
