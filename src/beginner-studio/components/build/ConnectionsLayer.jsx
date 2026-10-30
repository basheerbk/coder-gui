import React from 'react';

import {moduleById} from '../../domain/modules';
import {PORTS, cardCablePoint, portPosition} from '../../domain/ports';

import ConnectedModuleCard from './ConnectedModuleCard.jsx';
import ModuleArtNode, {artPlacement, hasModuleArt} from './ModuleArt.jsx';
import Rj11Cable from './Rj11Cable.jsx';

const noop = () => {};

/** Filters shared by the flat canvas and the 3D table layer. */
const SceneDefs = () => (
    <defs>
        <filter id="cardShadow" x="-30%" y="-30%" width="170%" height="180%">
            <feDropShadow dx="1" dy="8" stdDeviation="5" floodOpacity="0.4" />
        </filter>
        <filter id="boardShadow" x="-18%" y="-12%" width="140%" height="145%">
            <feDropShadow dx="2" dy="18" stdDeviation="16" floodOpacity="0.48" />
        </filter>
        <filter id="socketPop" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="1" dy="3" stdDeviation="2.2" floodOpacity="0.55" />
        </filter>
        <filter id="plugPop" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.8" floodOpacity="0.5" />
        </filter>
        <filter id="cableGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    </defs>
);

/**
 * Cables and plugged-in modules. Drag callbacks are optional so the 3D view can
 * show the same layout read-only (× still unplugs). Built-in parts (ONBOARD) get no cable.
 */
const ConnectionsLayer = ({
    connections,
    disconnect,
    K,
    dragModule = null,
    dragBend = null,
    onBendStart,
    onModuleMoveStart
}) => connections.map(conn => {
    const port = PORTS.find(p => p.id === conn.portId);
    if (!port) {
        return null;
    }
    const pos = portPosition(port);
    const live = dragModule && dragModule.id === conn.id;
    const offX = live ? live.x : (conn.offsetX || 0);
    const offY = live ? live.y : (conn.offsetY || 0);
    const cardX = pos.cardX + offX;
    const cardY = pos.cardY + offY;
    const placement = hasModuleArt(conn.moduleId) ? artPlacement(conn.moduleId, port, pos, offX, offY) : null;
    const attach = placement ? placement.jack : cardCablePoint(cardX, cardY, port.side);
    const liveBend = dragBend && dragBend.id === conn.id;
    const handleX = liveBend
        ? liveBend.x
        : (conn.bendX == null ? (pos.cableX + attach.x) / 2 : conn.bendX);
    const handleY = liveBend
        ? liveBend.y
        : (conn.bendY == null ? (pos.cableY + attach.y) / 2 : conn.bendY);
    const moveStart = onModuleMoveStart ? event => onModuleMoveStart(event, conn) : noop;
    return (
        <g key={conn.id}>
            {port.kind === 'onboard' ? null : (
                <Rj11Cable
                    x1={pos.cableX}
                    y1={pos.cableY}
                    x2={attach.x}
                    y2={attach.y}
                    handleX={handleX}
                    handleY={handleY}
                    dragging={Boolean(liveBend)}
                    color={port.signal === 'analog' ? K.analog : K.digital}
                    connectionId={conn.id}
                    onBendStart={onBendStart ? event => onBendStart(event, conn, handleX, handleY) : noop}
                />
            )}
            <g style={{pointerEvents: 'auto'}}>
                {placement ? (
                    <ModuleArtNode
                        moduleId={conn.moduleId}
                        name={(moduleById(conn.moduleId) || {}).name}
                        placement={placement}
                        dragging={Boolean(live)}
                        onDisconnect={() => disconnect(conn.id)}
                        onMoveStart={moveStart}
                        K={K}
                    />
                ) : (
                    <ConnectedModuleCard
                        connection={conn}
                        x={cardX}
                        y={cardY}
                        dragging={Boolean(live)}
                        onDisconnect={disconnect}
                        onMoveStart={moveStart}
                    />
                )}
            </g>
        </g>
    );
});

export {SceneDefs};
export default ConnectionsLayer;
