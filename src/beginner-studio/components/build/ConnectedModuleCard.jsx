import React from 'react';

import {CARD, DEPTH} from '../../domain/ports';
import {moduleById} from '../../domain/modules';
import {useStudio} from '../../context/StudioContext.jsx';
import {ModuleIconSvg} from '../shared/ModuleIcon.jsx';

const ConnectedModuleCard = ({
    connection,
    x,
    y,
    dragging,
    onDisconnect,
    onMoveStart
}) => {
    const {K} = useStudio();
    const mod = moduleById(connection.moduleId);
    if (!mod) {
        return null;
    }
    const slabRx = 14;
    const gid = `mod-${connection.id}`;

    return (
        <g
            transform={`translate(${x}, ${y})`}
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
            <title>{mod.name} — drag to move, press × to unplug</title>
            <defs>
                <linearGradient id={`${gid}-face`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                    <stop offset="35%" stopColor={mod.color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={K.panel} stopOpacity="1" />
                </linearGradient>
            </defs>
            <rect
                x={DEPTH.x + 1}
                y={DEPTH.y}
                width={CARD.w}
                height={CARD.h}
                rx={slabRx}
                fill="#020617"
                opacity={0.4}
            />
            <rect
                x={DEPTH.x}
                y={DEPTH.y - 2}
                width={CARD.w}
                height={CARD.h}
                rx={slabRx}
                fill={mod.color}
                opacity={0.7}
            />
            <rect
                x={0}
                y={0}
                width={CARD.w}
                height={CARD.h}
                rx={slabRx}
                fill={K.panel}
                stroke={mod.color}
                strokeWidth={2}
                filter="url(#cardShadow)"
            />
            <rect
                x={0}
                y={0}
                width={CARD.w}
                height={CARD.h}
                rx={slabRx}
                fill={`url(#${gid}-face)`}
            />
            <rect
                x={2}
                y={2}
                width={CARD.w - 4}
                height={11}
                rx={10}
                fill="#ffffff"
                opacity={0.18}
                style={{pointerEvents: 'none'}}
            />
            <ModuleIconSvg id={mod.id} color={mod.color} x={8} y={11} size={16} />
            <text
                x={28}
                y={24}
                fill={K.text}
                fontSize={10}
                fontWeight={800}
            >
                {mod.name}
            </text>
            <g
                style={{cursor: 'pointer'}}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                    e.stopPropagation();
                    onDisconnect(connection.id);
                }}
            >
                <circle
                    cx={CARD.w - 11}
                    cy={11}
                    r={9}
                    fill={K.red}
                    opacity={dragging ? 0.35 : 1}
                    filter="url(#plugPop)"
                />
                <text
                    x={CARD.w - 11}
                    y={15}
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

export default ConnectedModuleCard;
