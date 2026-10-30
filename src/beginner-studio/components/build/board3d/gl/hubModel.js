import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Group, Mesh, MeshBasicMaterial} from 'three';

import {HUB_JACK} from '../../../../domain/hubJacks';
import {moduleById} from '../../../../domain/modules';
import {
    BOARD,
    CARD,
    ESP,
    PORTS,
    SPARE_JACKS,
    cardCablePoint,
    portById,
    portColor,
    portPosition
} from '../../../../domain/ports';
import {ModuleIconSvg} from '../../../shared/ModuleIcon.jsx';
import {SceneDefs} from '../../ConnectionsLayer.jsx';
import {PortLabel, labelCenter, labelWidth} from '../../Port.jsx';

import {
    JACK_H,
    MODELS,
    OPEN_ROT,
    PCB_H,
    TABLE_Z,
    at,
    buildBoard as buildHub,
    buildJack,
    buildModule,
    glowDecal,
    ownCopy,
    placeModule
} from './hubKit';

const MOUTH_Z = JACK_H * 0.46;
const CARD_T = 5;
const JACK_R = 3.5;
const SPARE_COLOR = '#6b7280';
const OUTWARD = {top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0]};

/** Hub jack id → the studio port printed beside it. */
const SILK = Object.keys(HUB_JACK).reduce((all, id) => Object.assign(all, {[HUB_JACK[id]]: id}), {});

/** The RJ11 Hub and everything soldered to it, placed at the board's corner. */
const buildBoard = kit => {
    const hub = buildHub(kit, {labels: SILK});
    const group = new Group();
    const [bx, by] = at(BOARD.x, BOARD.y);
    group.position.set(bx, by, 0);
    group.add(hub.group);
    return {group, leds: hub.leds};
};

/** An RJ11 housing on a jack footprint, mouth towards its open edge. */
const placeJack = (kit, {footprint: fp, D, Wd, open}, color) => {
    const jack = buildJack(kit, {color, D, Wd});
    const [cx, cy] = at(fp.x + (fp.w / 2), fp.y + (fp.d / 2));
    jack.position.set(cx, cy, 0);
    jack.rotation.z = OPEN_ROT[open];
    return jack;
};

const highlight = color => new MeshBasicMaterial({color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false});

/** The port's name chip lying on top of its jack (or the ESP32 can) at height z. */
const labelDecal = (kit, port, pos, color, K, z) => {
    const {cx, cy} = labelCenter(port, pos);
    const box = {x: cx - (labelWidth(port) / 2) - 5, y: cy - 13, w: labelWidth(port) + 10, d: 26};
    const tex = kit.tex.svg(`label:${port.id}:${color}:${K.panel}`, box.w, box.d, renderToStaticMarkup(
        <g transform={`translate(${-box.x}, ${-box.y})`}>
            <SceneDefs />
            <PortLabel port={port} cx={cx} cy={cy} color={color} K={K} />
        </g>
    ), {ppu: 6});
    const label = kit.decal({
        ...box,
        z,
        material: new MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, toneMapped: false}),
        receive: false
    });
    label.renderOrder = 4;
    return label;
};

/**
 * Board jacks with highlight ring, glow and label; state is applied later by the controller.
 * ONBOARD is an invisible tap target over the ESP32 module (its meshes are marked hitOnly).
 */
const buildPorts = (kit, K) => PORTS.map(port => {
    const color = portColor(port, K);
    const pos = portPosition(port);
    let jack;
    let ring;
    let glow;
    let top;
    if (port.kind === 'onboard') {
        top = ESP.h;
        const cx = ESP.x + (ESP.w / 2);
        const cy = ESP.y + (ESP.d / 2);
        jack = kit.box({x: ESP.x - 3, y: ESP.y - 3, w: ESP.w + 6, d: ESP.d + 6, h: ESP.h + 0.5, color: '#000000', shadow: false});
        jack.traverse(obj => {
            if (obj.isMesh) {
                obj.material = new MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, colorWrite: false});
                obj.userData.portId = port.id;
                obj.userData.hitOnly = true;
            }
        });
        ring = new Mesh(kit.ring({w: ESP.w + 8, d: ESP.d + 8, r: 5, width: 2}), highlight(color));
        const [rx, ry] = at(cx, cy);
        ring.position.set(rx, ry, top + 0.08);
        glow = glowDecal(kit, {cx, cy, size: ESP.d + 60, z: top + 0.05, color, opacity: 0});
        const holder = new Group();
        holder.add(jack, ring, glow);
        jack = holder;
    } else {
        top = JACK_H;
        jack = placeJack(kit, pos, color);
        // Per-jack materials so dimming one jack doesn't dim them all
        jack.traverse(obj => {
            if (obj.isMesh) {
                obj.material = Array.isArray(obj.material) ? obj.material.map(ownCopy) : ownCopy(obj.material);
                obj.userData.portId = port.id;
            }
        });
        ring = new Mesh(kit.ring({w: pos.D, d: pos.Wd, r: JACK_R, width: 1.8}), highlight(color));
        ring.position.z = JACK_H + 0.08;
        jack.add(ring);
        glow = glowDecal(kit, {cx: 0, cy: 0, size: Math.max(pos.D, pos.Wd) + 34, z: JACK_H + 0.05, color, opacity: 0});
        jack.add(glow);
    }
    ring.renderOrder = 2;
    glow.renderOrder = 1;
    const label = labelDecal(kit, port, pos, color, K, top + 0.15);
    return {port, jack, ring, glow, label, color};
});

/** Hub jacks with no studio port: drawn in grey, never pickable. */
const buildSpareJacks = kit => {
    const group = new Group();
    SPARE_JACKS.forEach(spare => group.add(placeJack(kit, spare, SPARE_COLOR)));
    return group;
};

/** Modules without a model sit on the table as a labelled slab, like the edit view's card. */
const buildCard = (kit, mod, K, x, y) => {
    const tex = kit.tex.svg(`card:${mod.id}:${K.panel}:${K.text}`, CARD.w, CARD.h, renderToStaticMarkup(
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

const tag = (group, conn, name) => {
    group.traverse(obj => {
        if (obj.isMesh) {
            obj.userData.connId = conn.id;
            obj.userData.moduleName = name;
        }
    });
};

/**
 * One plugged-in module: its mesh group, where its cable plugs in (world x, y plus height z,
 * with the direction the plug points; no cable for built-in parts) and where its unplug badge floats.
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
    const model = MODELS[conn.moduleId];
    const dir = OUTWARD[port.side] || OUTWARD.right;

    let group = null;
    let attach;
    let badge;
    if (model) {
        group = buildModule(kit, model, {});
        const placement = placeModule(group.userData.spec, {side: port.side, pos}, offX, offY);
        const [cx, cy] = at(placement.cx, placement.cy);
        group.position.set(cx, cy, TABLE_Z);
        // SVG rotate() is clockwise with y down; board space has y up
        group.rotation.z = -placement.rotation * (Math.PI / 180);
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
        from: port.kind === 'onboard' ? null : {x: pos.cableX, y: pos.cableY, z: MOUTH_Z, dir},
        to: {...attach, dir}
    };
};

export {MOUTH_Z, TABLE_Z, buildBoard, buildConnection, buildPorts, buildSpareJacks};
