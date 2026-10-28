import React from 'react';

import {JACK, portColor} from '../../domain/ports';
import {useStudio} from '../../context/StudioContext.jsx';

const sideRotate = {
    top: 90,
    bottom: -90,
    left: 0,
    right: 180
};

/** Six gold contacts, spaced across the jack mouth (local Y). */
const CONTACT_YS = [0, 1, 2, 3, 4, 5].map(i => (JACK.h * 0.28) + (i * ((JACK.h * 0.44) / 5)));

/** Board-side anchor for a jack's label chip, inboard of the jack at (x, y). */
const labelAnchor = (side, x, y) => {
    if (side === 'top') {
        return {x: x + (JACK.w / 2), y: y + JACK.h + 15, anchor: 'middle'};
    }
    if (side === 'bottom') {
        return {x: x + (JACK.w / 2), y: y - 9, anchor: 'middle'};
    }
    if (side === 'left') {
        return {x: x + JACK.w + 9, y: y + (JACK.h / 2) + 4, anchor: 'start'};
    }
    return {x: x - 9, y: y + (JACK.h / 2) + 4, anchor: 'end'};
};

const PortLabel = ({port, x, y, color, K, opacity = 1}) => {
    const labelG = labelAnchor(port.side, x, y);
    const chipW = Math.max(32, (String(port.label).length * 8) + 14);
    const chipX = labelG.anchor === 'middle'
        ? labelG.x - (chipW / 2)
        : (labelG.anchor === 'end' ? labelG.x - chipW + 2 : labelG.x - 2);
    return (
        <g
            opacity={opacity}
            style={{pointerEvents: 'none'}}
        >
            <rect
                x={chipX}
                y={labelG.y - 12}
                width={chipW}
                height={16}
                rx={8}
                fill={K.panel}
                stroke={color}
                strokeWidth={1.4}
                opacity={0.96}
                filter="url(#socketPop)"
            />
            <text
                x={labelG.x}
                y={labelG.y}
                textAnchor={labelG.anchor}
                fill={color}
                fontSize={11}
                fontWeight={800}
            >
                {port.label}
            </text>
        </g>
    );
};

const portTitle = (port, {occupied, compatible, dimmed}) => {
    if (occupied) {
        return `${port.label} is in use`;
    }
    if (compatible) {
        return `Snap into ${port.label}`;
    }
    if (dimmed) {
        return `${port.label} needs a ${port.kind} module`;
    }
    return port.label;
};

const Port = ({
    port,
    x,
    y,
    occupied,
    compatible,
    dimmed,
    flashing,
    onClick
}) => {
    const {K} = useStudio();
    const color = portColor(port, K);
    const opacity = occupied || compatible ? 1 : (dimmed ? 0.2 : 0.92);
    const rot = sideRotate[port.side] || 0;
    const gid = `sock-${port.id}`;

    const title = portTitle(port, {occupied, compatible, dimmed});

    return (
        <g opacity={opacity}>
            <defs>
                <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2c2c2c" />
                    <stop offset="100%" stopColor="#0c0c0c" />
                </linearGradient>
            </defs>
            <g
                transform={`translate(${x + (JACK.w / 2)}, ${y + (JACK.h / 2)}) rotate(${rot}) translate(${-(JACK.w / 2)}, ${-(JACK.h / 2)})`}
                style={{cursor: compatible ? 'pointer' : (dimmed ? 'not-allowed' : 'grab')}}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                    e.stopPropagation();
                    onClick();
                }}
            >
                <title>{title}</title>
                <rect x={-10} y={-10} width={JACK.w + 20} height={JACK.h + 20} fill="transparent" />

                {compatible ? (
                    <rect
                        x={-6}
                        y={-6}
                        width={JACK.w + 12}
                        height={JACK.h + 12}
                        rx={11}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.4}
                        opacity={0.85}
                        filter="url(#cableGlow)"
                    >
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
                    </rect>
                ) : null}
                {flashing ? (
                    <circle cx={JACK.w / 2} cy={JACK.h / 2} r={14} fill="none" stroke={color} strokeWidth={2.4}>
                        <animate attributeName="r" from="12" to="28" dur="0.4s" fill="freeze" />
                        <animate attributeName="opacity" from="1" to="0" dur="0.4s" fill="freeze" />
                    </circle>
                ) : null}

                {/* Cast shadow */}
                <rect
                    x={2}
                    y={3.5}
                    width={JACK.w}
                    height={JACK.h}
                    rx={3.5}
                    fill="#020617"
                    opacity={0.35}
                />

                {/* Black molded housing; a thin coloured band at the back keeps the port-type cue */}
                <rect
                    width={JACK.w}
                    height={JACK.h}
                    rx={3.5}
                    fill={`url(#${gid}-body)`}
                    stroke={occupied ? color : '#000'}
                    strokeWidth={occupied ? 2 : 0.8}
                    filter="url(#socketPop)"
                />
                <rect
                    x={JACK.w - 4.5}
                    y={3}
                    width={2.5}
                    height={JACK.h - 6}
                    rx={1.2}
                    fill={color}
                    opacity={0.9}
                />

                {/* Mouth lip, contact cavity and rear latch block */}
                <rect
                    width={4}
                    height={JACK.h}
                    rx={2}
                    fill="#2f2f2f"
                />
                <rect
                    x={4}
                    y={JACK.h * 0.2}
                    width={JACK.w * 0.6}
                    height={JACK.h * 0.6}
                    rx={1.5}
                    fill="#050505"
                    stroke="#1f1f1f"
                    strokeWidth={0.8}
                />
                <rect
                    x={JACK.w * 0.7}
                    y={JACK.h * 0.12}
                    width={JACK.w * 0.12}
                    height={JACK.h * 0.76}
                    rx={1}
                    fill="#151515"
                    stroke="#2c2c2c"
                    strokeWidth={0.6}
                />
                <line
                    x1={5}
                    y1={1.6}
                    x2={JACK.w - 6}
                    y2={1.6}
                    stroke="#3a3a3a"
                    strokeWidth={1}
                />

                {/* Gold contacts */}
                {CONTACT_YS.map(cy => (
                    <g key={cy}>
                        <path
                            d={`M 6 ${cy} L ${(JACK.w * 0.6) - 2} ${cy} L ${JACK.w * 0.6} ${cy + 2}`}
                            fill="none"
                            stroke="#b88f37"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d={`M 6 ${cy - 0.4} L ${(JACK.w * 0.6) - 2} ${cy - 0.4}`}
                            stroke="#f5dc93"
                            strokeWidth={0.5}
                            strokeLinecap="round"
                        />
                    </g>
                ))}
            </g>

            <PortLabel
                port={port}
                x={x}
                y={y}
                color={color}
                K={K}
            />
        </g>
    );
};

export {PortLabel, labelAnchor, portTitle};
export default Port;
