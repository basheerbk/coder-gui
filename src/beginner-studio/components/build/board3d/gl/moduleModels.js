import React from 'react';
import {Group} from 'three';

import {moduleById} from '../../../../domain/modules';
import {CARD, JACK, cardCablePoint, portById, portPosition} from '../../../../domain/ports';
import {ModuleIconSvg} from '../../../shared/ModuleIcon.jsx';
import {placeModule} from '../../ModuleArt.jsx';
import {JACK_H} from '../Jack3D.jsx';
import {MODULE_3D, PCB_H, PcbTop} from '../Module3D.jsx';
import {chipTop} from '../Parts3D.jsx';

import {TABLE_Z, buildJack, glowDecal, passiveTexture} from './boardModel';
import {at} from './kit';

const TOP = PCB_H;
const MOUTH_Z = JACK_H * 0.46;
const CARD_T = 5;

/** Dotted wire mesh over a base colour, drawn to scale (pitch in board units). */
const meshTexture = (kit, key, w, h, pitch, base, dot) => kit.tex.canvas(`mesh:${key}`, w, h, (ctx, cw, ch) => {
    const s = cw / w;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = dot;
    const r = pitch * 0.3 * s;
    for (let y = pitch / 2; y < h; y += pitch) {
        for (let x = pitch / 2; x < w; x += pitch) {
            ctx.beginPath();
            ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}, {ppu: 10});

const resistor = (kit, g, x, y) => g.add(kit.box({
    x,
    y,
    w: 10,
    d: 5,
    h: 2.2,
    z: TOP,
    color: '#121212',
    faces: {t: {map: passiveTexture(kit, 'R', true), rough: 0.45}}
}));

const chip = (kit, g, x, y, w, d, h = 2.4) => g.add(kit.box({
    x,
    y,
    w,
    d,
    h,
    z: TOP,
    color: {color: '#151617', rough: 0.45},
    faces: {t: {map: kit.tex.svg(`chip:${w}:${d}`, w, d, chipTop(w, d), {ppu: 8, base: '#1a1b1d'}), rough: 0.45}}
}));

const trimmer = (kit, g, x, y) => g.add(kit.box({
    x,
    y,
    w: 10,
    d: 10,
    h: 6,
    z: TOP,
    color: {color: '#2a62bf', rough: 0.45},
    faces: {
        t: {
            map: kit.tex.svg('trimmer', 10, 10, (
                <g>
                    <rect width={10} height={10} fill="#2f6fd6" />
                    <circle cx={5} cy={5} r={3.4} fill="#d8b25a" stroke="#9c7a2c" strokeWidth={0.4} />
                    <path d="M3 5 H7 M5 3 V7" stroke="#7a5a1c" strokeWidth={0.8} />
                </g>
            ), {ppu: 12, base: '#2f6fd6'}),
            rough: 0.4
        }
    }
}));

const smdLed = (kit, g, x, y, color) => g.add(kit.box({
    x,
    y,
    w: 4,
    d: 3,
    h: 1.2,
    z: TOP,
    color: {color: '#e8e5dc', rough: 0.4},
    faces: {t: kit.basic({color})}
}));

const crystal = (kit, g, x, y, w, d) => g.add(kit.slab({
    x,
    y,
    w,
    d,
    h: 3,
    z: TOP,
    r: d / 2,
    top: {color: '#d9dbdd', rough: 0.25, metal: 0.9},
    side: {color: '#a9acaf', rough: 0.3, metal: 0.9}
}));

/** Metal can with a mesh top and a perforated wall. */
const meshCan = (kit, g, {key, cx, cy, r, z0, z1, pitch, topBase, topDot}) => {
    const h = z1 - z0;
    const circ = Math.PI * 2 * r;
    g.add(kit.cylinder({
        cx,
        cy,
        r,
        z0,
        z1,
        seg: 40,
        side: {map: meshTexture(kit, `${key}-wall`, circ, h, pitch, '#c3c6c9', '#6d7174'), rough: 0.35, metal: 0.8},
        top: {map: meshTexture(kit, `${key}-top`, r * 2, r * 2, pitch, topBase, topDot), rough: 0.5, metal: 0.4}
    }));
};

const PARTS = {
    led: (kit, g) => {
        resistor(kit, g, 50, 13);
        g.add(glowDecal(kit, {cx: 80, cy: 26, size: 44, z: TOP + 0.2, color: '#ffd628', opacity: 0.55}));
        g.add(kit.lathe({
            key: 'led5mm',
            cx: 80,
            cy: 26,
            z: TOP,
            profile: [[0, 0], [7.5, 0], [7.5, 1.2], [6.6, 1.2], [6.6, 8.6], [6.2, 9.8], [5.2, 10.8], [3.6, 11.5], [0, 11.8]],
            material: {color: '#f2c200', rough: 0.22, emissive: '#ffb800', emissiveIntensity: 0.4, opacity: 0.94}
        }));
    },
    btn: (kit, g) => {
        resistor(kit, g, 38, 38);
        g.add(kit.box({
            x: 54,
            y: 12,
            w: 24,
            d: 24,
            h: 6,
            z: TOP,
            color: {color: '#1c1c1c', rough: 0.5},
            faces: {
                t: {
                    map: kit.tex.svg('btn-top', 24, 24, (
                        <g>
                            <defs>
                                <linearGradient id="bt" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#e3e4e5" />
                                    <stop offset="100%" stopColor="#9fa1a3" />
                                </linearGradient>
                            </defs>
                            <rect width={24} height={24} fill="url(#bt)" />
                            {[[3, 3], [21, 3], [3, 21], [21, 21]].map(([px, py]) => (
                                <circle key={`${px}-${py}`} cx={px} cy={py} r={1.3} fill="#6d6f71" />
                            ))}
                        </g>
                    ), {ppu: 8, base: '#c0c2c4'}),
                    rough: 0.35,
                    metal: 0.5
                }
            }
        }));
        g.add(kit.cylinder({
            cx: 66,
            cy: 24,
            r: 7.5,
            z0: TOP + 6,
            z1: TOP + 10.4,
            side: {color: '#9e1c1c', rough: 0.45},
            top: {color: '#d32f2f', rough: 0.35}
        }));
    },
    dht: (kit, g) => {
        resistor(kit, g, 36, 4);
        g.add(kit.slab({
            x: 50,
            y: 8,
            w: 52,
            d: 40,
            h: 13,
            z: TOP,
            r: 1.5,
            top: {
                map: kit.tex.svg('dht-top', 52, 40, (
                    <g>
                        <rect width={52} height={40} fill="#4b92e0" />
                        {[0, 1, 2, 3, 4].map(row => [0, 1, 2, 3, 4, 5].map(col => (
                            <rect
                                key={`${row}-${col}`}
                                x={5 + (col * 7.4)}
                                y={5 + (row * 6.4)}
                                width={4.4}
                                height={3.6}
                                rx={0.6}
                                fill="#1d4f8f"
                            />
                        )))}
                    </g>
                ), {ppu: 8, base: '#4b92e0'}),
                rough: 0.55
            },
            side: {color: '#3a7fcf', rough: 0.55}
        }));
    },
    pot: (kit, g) => {
        g.add(kit.box({
            x: 52,
            y: 12,
            w: 26,
            d: 24,
            h: 7,
            z: TOP,
            color: {color: '#2a62c4', rough: 0.45},
            faces: {t: {color: '#3b7be0', rough: 0.45}}
        }));
        g.add(kit.cylinder({cx: 65, cy: 24, r: 4.5, z0: TOP + 7, z1: TOP + 10, side: {color: '#b9bcbf', rough: 0.3, metal: 0.9}}));
        g.add(kit.cylinder({
            cx: 65,
            cy: 24,
            r: 9,
            z0: TOP + 10,
            z1: TOP + 18,
            seg: 36,
            side: {color: '#161616', rough: 0.55},
            top: {color: '#2b2b2b', rough: 0.45}
        }));
        g.add(kit.decal({x: 64.1, y: 16, w: 1.8, d: 6, z: TOP + 18.05, material: kit.basic({color: '#f4f4f0'})}));
    },
    mq2: (kit, g) => {
        trimmer(kit, g, 38, 4);
        smdLed(kit, g, 38, 46, '#ff3b3b');
        smdLed(kit, g, 46, 46, '#3bff6e');
        g.add(kit.cylinder({
            cx: 82,
            cy: 28,
            r: 18,
            z0: TOP,
            z1: TOP + 3,
            seg: 40,
            side: {color: '#a8601f', rough: 0.6},
            top: {color: '#c7782f', rough: 0.55}
        }));
        meshCan(kit, g, {
            key: 'mq2',
            cx: 82,
            cy: 28,
            r: 15,
            z0: TOP + 3,
            z1: TOP + 15,
            pitch: 2.4,
            topBase: '#c9cbcd',
            topDot: '#3a3c3e'
        });
    },
    mic: (kit, g) => {
        trimmer(kit, g, 38, 4);
        chip(kit, g, 40, 26, 14, 10);
        smdLed(kit, g, 58, 36, '#ff3b3b');
        g.add(kit.cylinder({
            cx: 78,
            cy: 22,
            r: 9,
            z0: TOP,
            z1: TOP + 8,
            side: {color: '#111111', rough: 0.45, metal: 0.3},
            top: {map: meshTexture(kit, 'mic-top', 18, 18, 1.6, '#2c2c2c', '#0c0c0c'), rough: 0.8}
        }));
    },
    pulse: (kit, g) => {
        g.add(kit.box({
            x: 48,
            y: 18,
            w: 14,
            d: 12,
            h: 2.2,
            z: TOP,
            color: {color: '#121216', rough: 0.4},
            faces: {
                t: {
                    map: kit.tex.svg('pulse-sensor', 14, 12, (
                        <g>
                            <rect width={14} height={12} fill="#0c0c10" />
                            <rect x={2} y={3} width={4.5} height={6} rx={0.8} fill="#2a0d12" stroke="#ff4d6d" strokeWidth={0.5} />
                            <rect x={7.5} y={3} width={4.5} height={6} rx={0.8} fill="#140d22" stroke="#9c7bff" strokeWidth={0.5} />
                        </g>
                    ), {ppu: 12, base: '#0c0c10'}),
                    rough: 0.2
                }
            }
        }));
        resistor(kit, g, 36, 6);
        resistor(kit, g, 36, 38);
        chip(kit, g, 66, 34, 7, 6, 1.6);
    },
    soil: (kit, g) => {
        chip(kit, g, 34, 4, 12, 10);
        chip(kit, g, 34, 26, 10, 8, 3);
        resistor(kit, g, 50, 16);
    },
    ultra: (kit, g) => {
        [64, 104].forEach(cx => meshCan(kit, g, {
            key: 'sonar',
            cx,
            cy: 26,
            r: 16,
            z0: TOP,
            z1: TOP + 12,
            pitch: 2.2,
            topBase: '#3e4042',
            topDot: '#1a1b1c'
        }));
        crystal(kit, g, 80, 2, 8, 4);
    },
    rfid: (kit, g) => {
        chip(kit, g, 34, 34, 14, 14, 1.6);
        crystal(kit, g, 34, 56, 11, 4);
        resistor(kit, g, 34, 20);
    }
};

const tag = (group, conn, name) => {
    group.traverse(obj => {
        if (obj.isMesh) {
            obj.userData.connId = conn.id;
            obj.userData.moduleName = name;
        }
    });
};

/** A modelled module: PCB, socket and parts, turned so the socket faces its board jack. */
const buildModel = (kit, spec, moduleId, placement) => {
    const outer = new Group();
    const [cx, cy] = at(placement.cx, placement.cy);
    outer.position.set(cx, cy, TABLE_Z);
    // CSS rotate() is clockwise with y down; board space has y up
    outer.rotation.z = -placement.rotation * (Math.PI / 180);

    const g = new Group();
    const [ox, oy] = at(-spec.w / 2, -spec.h / 2);
    g.position.set(ox, oy, 0);
    outer.add(g);

    g.add(kit.slab({
        x: 0,
        y: 0,
        w: spec.w,
        d: spec.h,
        h: PCB_H,
        r: 2,
        top: {
            map: kit.tex.svg(`pcb:${moduleId}`, spec.w, spec.h, (
                <g>
                    <rect width={spec.w} height={spec.h} fill={spec.pcb} />
                    <PcbTop spec={spec} />
                </g>
            ), {ppu: 6, base: spec.pcb}),
            rough: 0.6
        },
        side: {color: spec.edge, rough: 0.7}
    }));

    const socket = buildJack(kit, {color: '#8d9093'});
    const [sx, sy] = at(-2 + (JACK.w / 2), spec.jackY);
    socket.position.set(sx, sy, PCB_H);
    g.add(socket);

    const parts = PARTS[moduleId];
    if (parts) {
        parts(kit, g);
    }
    return outer;
};

/** Modules without a model sit on the table as a labelled slab, like the edit view's card. */
const buildCard = (kit, mod, K, x, y) => {
    const tex = kit.tex.svg(`card:${mod.id}:${K.panel}:${K.text}`, CARD.w, CARD.h, (
        <g>
            <defs>
                <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                    <stop offset="35%" stopColor={mod.color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={K.panel} stopOpacity="1" />
                </linearGradient>
            </defs>
            <rect width={CARD.w} height={CARD.h} fill={K.panel} />
            <rect width={CARD.w} height={CARD.h} fill="url(#cf)" />
            <rect x={1} y={1} width={CARD.w - 2} height={CARD.h - 2} rx={13} fill="none" stroke={mod.color} strokeWidth={2} />
            <ModuleIconSvg id={mod.id} color={mod.color} x={8} y={11} size={16} />
            <text x={28} y={24} fill={K.text} fontSize={10} fontWeight={800}>{mod.name}</text>
        </g>
    ), {ppu: 6, base: K.panel});
    return kit.slab({
        x,
        y,
        w: CARD.w,
        d: CARD.h,
        h: CARD_T,
        z: TABLE_Z,
        r: 12,
        top: {map: tex, rough: 0.5},
        side: {color: mod.color, rough: 0.5}
    });
};

const OUTWARD = {top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0]};

/**
 * One plugged-in module: its mesh group, where its cable plugs in (world x, y plus height z,
 * with the direction the plug points) and where its unplug badge floats.
 */
const buildConnection = (kit, conn, K) => {
    const port = portById(conn.portId);
    if (!port) {
        return null;
    }
    const pos = portPosition(port);
    const offX = conn.offsetX || 0;
    const offY = conn.offsetY || 0;
    const mod = moduleById(conn.moduleId);
    const name = (mod || {}).name || conn.moduleId;
    const spec = MODULE_3D[conn.moduleId];
    const dir = OUTWARD[port.side] || OUTWARD.right;

    let group = null;
    let attach;
    let badge;
    if (spec) {
        const placement = placeModule(spec, port, pos, offX, offY);
        group = buildModel(kit, spec, conn.moduleId, placement);
        attach = {...placement.jack, z: TABLE_Z + PCB_H + MOUTH_Z};
        badge = {x: placement.cx + (placement.boxW / 2), y: placement.cy - (placement.boxH / 2), z: TABLE_Z + 22};
    } else {
        const cardX = pos.cardX + offX;
        const cardY = pos.cardY + offY;
        attach = {...cardCablePoint(cardX, cardY, port.side), z: TABLE_Z + (CARD_T / 2)};
        badge = {x: cardX + CARD.w - 11, y: cardY + 11, z: TABLE_Z + CARD_T + 4};
        if (mod) {
            group = new Group();
            group.add(buildCard(kit, mod, K, cardX, cardY));
        }
    }
    if (group) {
        tag(group, conn, name);
    }
    return {
        conn,
        port,
        name,
        group,
        badge,
        from: {x: pos.cableX, y: pos.cableY, z: MOUTH_Z, dir},
        to: {...attach, dir}
    };
};

export {MOUTH_Z, buildConnection};
