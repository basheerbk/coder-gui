import React from 'react';

import {MODULE_ART} from '../../assets/hub';
import {CARD, STUB, portById, portPosition} from '../../domain/ports';

const hasModuleArt = moduleId => Boolean(MODULE_ART[moduleId]);

const ROTATION_BY_SIDE = {top: -90, bottom: 90, right: 0, left: 180};

/**
 * Places a module of w × h world units, socket on its left edge at jackY, so the socket faces
 * the board jack, then applies the user's drag offset.
 * Returns the centre, rotation, rotated bounding box and the world point of the socket.
 */
const placeModule = ({w, h, jackY: socketY}, port, pos, offsetX = 0, offsetY = 0) => {
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

const artPlacement = (moduleId, port, pos, offsetX = 0, offsetY = 0) => placeModule(
    MODULE_ART[moduleId],
    port,
    pos,
    offsetX,
    offsetY
);

/** World-space box {x, y, w, h} a plugged module (art or card) covers at the given drag offset. */
const connectionBox = (conn, offsetX = 0, offsetY = 0) => {
    const port = portById(conn.portId);
    if (!port) {
        return null;
    }
    const pos = portPosition(port);
    if (hasModuleArt(conn.moduleId)) {
        const {cx, cy, boxW, boxH} = artPlacement(conn.moduleId, port, pos, offsetX, offsetY);
        return {x: cx - (boxW / 2), y: cy - (boxH / 2), w: boxW, h: boxH};
    }
    return {x: pos.cardX + offsetX, y: pos.cardY + offsetY, w: CARD.w, h: CARD.h};
};

const GAP = 6;
const STEP = 8;
const MAX_SHIFT = 240;

const overlaps = (a, b) => (
    a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP &&
    a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP
);

/**
 * Smallest drag offset that keeps `conn` clear of the `placed` connections: slides along the
 * board edge first (either way), then away from it. Falls back to no offset.
 */
const clearOffset = (conn, placed) => {
    const port = portById(conn.portId);
    const boxes = placed.map(c => connectionBox(c, c.offsetX || 0, c.offsetY || 0)).filter(Boolean);
    if (!port || !boxes.length) {
        return {offsetX: 0, offsetY: 0};
    }
    const alongX = port.side === 'top' || port.side === 'bottom';
    const outward = {top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0]}[port.side] || [0, 0];
    const fits = (x, y) => {
        const box = connectionBox(conn, x, y);
        return box && !boxes.some(b => overlaps(box, b));
    };
    for (let d = 0; d <= MAX_SHIFT; d += STEP) {
        const tries = [
            alongX ? [-d, 0] : [0, -d],
            alongX ? [d, 0] : [0, d],
            [outward[0] * d, outward[1] * d]
        ];
        const hit = tries.find(([x, y]) => fits(x, y));
        if (hit) {
            return {offsetX: hit[0], offsetY: hit[1]};
        }
    }
    return {offsetX: 0, offsetY: 0};
};

/** Gives every connection without a saved offset a spot clear of the ones before it. */
const spreadConnections = connections => connections.reduce((placed, conn) => {
    const fixed = Object.assign({}, conn, conn.offsetX || conn.offsetY ? {} : clearOffset(conn, placed));
    return placed.concat([fixed]);
}, []);

const UnplugButton = ({x, y, dragging, onDisconnect, K}) => (
    <g
        style={{cursor: 'pointer'}}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
            e.stopPropagation();
            onDisconnect();
        }}
    >
        <circle
            cx={x}
            cy={y}
            r={9}
            fill={K.red}
            opacity={dragging ? 0.35 : 1}
            filter="url(#plugPop)"
        />
        <text
            x={x}
            y={y + 4}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight={800}
        >
            ×
        </text>
    </g>
);

const ModuleArtNode = ({moduleId, name, placement, dragging, onMoveStart, onDisconnect, K}) => {
    const art = MODULE_ART[moduleId];
    if (!art) {
        return null;
    }
    const {cx, cy, rotation, boxW, boxH} = placement;
    const [bx, by, bw, bh] = art.box;
    const closeX = cx + (boxW / 2);
    const closeY = cy - (boxH / 2);
    return (
        <g
            style={{
                animation: dragging ? 'none' : 'tbSlideIn 0.25s ease',
                cursor: dragging ? 'grabbing' : 'grab'
            }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => {
                if (e.button !== 0) {
                    return;
                }
                e.stopPropagation();
                onMoveStart(e);
            }}
        >
            <title>{name} — drag to move, press × to unplug</title>
            <g
                transform={`translate(${cx}, ${cy}) rotate(${rotation})`}
                filter="url(#cardShadow)"
            >
                <image
                    xlinkHref={art.src}
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    preserveAspectRatio="none"
                />
            </g>
            <UnplugButton
                x={closeX}
                y={closeY}
                dragging={dragging}
                onDisconnect={onDisconnect}
                K={K}
            />
        </g>
    );
};

export {MODULE_ART, hasModuleArt, artPlacement, clearOffset, connectionBox, placeModule, spreadConnections, UnplugButton};
export default ModuleArtNode;
