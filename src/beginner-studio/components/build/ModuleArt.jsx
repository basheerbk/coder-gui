import React from 'react';

import {STUB} from '../../domain/ports';

const ART_SCALE = 4;

const LedArt = () => (
    <g>
        <rect width="26" height="12" rx="1" fill="#36673B" />
        <path d="M18.1871 3V1.10277H18.5308V2.71189H19.3664V3H18.1871ZM19.6647 3V1.10277H20.8987V1.39087H20.0084V1.90594H20.8347V2.19405H20.0084V2.71189H20.9061V3H19.6647ZM21.8922 3H21.2493V1.10277H21.9052C22.0935 1.10277 22.2553 1.14075 22.3906 1.21671C22.5265 1.29206 22.6308 1.40044 22.7037 1.54187C22.7766 1.6833 22.813 1.85252 22.813 2.04953C22.813 2.24716 22.7763 2.417 22.7028 2.55904C22.6299 2.70109 22.5246 2.81009 22.3869 2.88605C22.2498 2.96202 22.0849 3 21.8922 3ZM21.593 2.70263H21.8755C22.0077 2.70263 22.1179 2.67854 22.2062 2.63037C22.2946 2.58158 22.3609 2.50902 22.4054 2.41267C22.4499 2.31571 22.4721 2.19466 22.4721 2.04953C22.4721 1.9044 22.4499 1.78397 22.4054 1.68824C22.3609 1.5919 22.2952 1.51995 22.2081 1.47239C22.1216 1.42422 22.0142 1.40014 21.8857 1.40014H21.593V2.70263Z" fill="white" />
        <path d="M0 1.5H13.5C13.7761 1.5 14 1.72386 14 2V10C14 10.2761 13.7761 10.5 13.5 10.5H0V1.5Z" fill="black" />
        <rect y="1.5" width="2" height="9" fill="#1D1D1D" />
        <rect y="3.5" width="2" height="5" fill="black" />
        <path d="M2 3.4H14M2 4.4H14M2 5.4H14M2 6.4H14M2 7.4H14M2 8.4H14" strokeWidth="0.2" stroke="white" />
        <rect x="2" y="2.5" width="1" height="7" fill="black" fillOpacity="0.78" />
        <path d="M1 10.5V11M1 1.5V1" strokeWidth="0.3" stroke="black" />
        <circle cx="20.5" cy="7.5" r="2.5" fill="#D9D9D9" fillOpacity="0.2" />
        <circle cx="20.5" cy="7.5" r="1.5" fill="#FFE100" fillOpacity="0.2" />
        <rect x="15" y="5" width="1" height="2.33333" rx="0.1" transform="rotate(-90 15 5)" fill="#D9D9D9" />
        <rect x="15.3333" y="5" width="1" height="1.66667" transform="rotate(-90 15.3333 5)" fill="black" />
    </g>
);

/** Artwork in its own units; the RJ11 socket opening sits on the left edge at (0, jackY). */
const MODULE_ART = {
    led: {w: 26, h: 12, jackY: 6, Art: LedArt}
};

const hasModuleArt = moduleId => Boolean(MODULE_ART[moduleId]);

const ROTATION_BY_SIDE = {top: -90, bottom: 90, right: 0, left: 180};

/**
 * Places the artwork so its socket faces the board jack, then applies the user's drag offset.
 * Returns the art centre, rotation, rotated bounding box and the world point of the socket.
 */
const artPlacement = (moduleId, port, pos, offsetX = 0, offsetY = 0) => {
    const art = MODULE_ART[moduleId];
    const w = art.w * ART_SCALE;
    const h = art.h * ART_SCALE;
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
    const localY = (art.jackY * ART_SCALE) - (h / 2);
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

const ModuleArtNode = ({moduleId, name, placement, dragging, onMoveStart, onDisconnect, K}) => {
    const art = MODULE_ART[moduleId];
    if (!art) {
        return null;
    }
    const {cx, cy, w, h, rotation, boxW, boxH} = placement;
    const {Art} = art;
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
                transform={`translate(${cx}, ${cy}) rotate(${rotation}) translate(${-w / 2}, ${-h / 2})`}
                filter="url(#cardShadow)"
            >
                <g transform={`scale(${ART_SCALE})`}>
                    <Art />
                </g>
            </g>
            <g
                style={{cursor: 'pointer'}}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                    e.stopPropagation();
                    onDisconnect();
                }}
            >
                <circle
                    cx={closeX}
                    cy={closeY}
                    r={9}
                    fill={K.red}
                    opacity={dragging ? 0.35 : 1}
                    filter="url(#plugPop)"
                />
                <text
                    x={closeX}
                    y={closeY + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={11}
                    fontWeight={800}
                >
                    ×
                </text>
            </g>
        </g>
    );
};

export {MODULE_ART, hasModuleArt, artPlacement};
export default ModuleArtNode;
