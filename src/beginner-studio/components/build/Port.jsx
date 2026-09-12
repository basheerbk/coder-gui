import React from 'react';

import {JACK} from '../../domain/ports';
import {useStudio} from '../../context/StudioContext.jsx';

const sideRotate = {
    top: 90,
    bottom: -90,
    left: 0,
    right: 180
};

/** U-notch pocket — opening faces local -X (rotated per side). */
const notchPath = (w, h) => {
    const r = 8;
    const mouth = 12;
    const depth = w - 4;
    return [
        `M ${w} ${r}`,
        `Q ${w} 0 ${w - r} 0`,
        `L ${r} 0`,
        `Q 0 0 0 ${r}`,
        `L 0 ${(h - mouth) / 2}`,
        `L ${depth - 5} ${(h - mouth) / 2}`,
        `Q ${depth} ${(h - mouth) / 2} ${depth} ${(h - mouth) / 2 + 5}`,
        `L ${depth} ${(h + mouth) / 2 - 5}`,
        `Q ${depth} ${(h + mouth) / 2} ${depth - 5} ${(h + mouth) / 2}`,
        `L 0 ${(h + mouth) / 2}`,
        `L 0 ${h - r}`,
        `Q 0 ${h} ${r} ${h}`,
        `L ${w - r} ${h}`,
        `Q ${w} ${h} ${w} ${h - r}`,
        'Z'
    ].join(' ');
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
    const color = port.signal === 'analog' ? K.analog : K.digital;
    const opacity = occupied || compatible ? 1 : (dimmed ? 0.2 : 0.92);
    const rot = sideRotate[port.side] || 0;
    const gid = `sock-${port.id}`;

    const labelG = (() => {
        if (port.side === 'top') {
            return {x: x + (JACK.w / 2), y: y + JACK.h + 15, anchor: 'middle'};
        }
        if (port.side === 'bottom') {
            return {x: x + (JACK.w / 2), y: y - 9, anchor: 'middle'};
        }
        if (port.side === 'left') {
            return {x: x + JACK.w + 9, y: y + (JACK.h / 2) + 4, anchor: 'start'};
        }
        return {x: x - 9, y: y + (JACK.h / 2) + 4, anchor: 'end'};
    })();

    const title = occupied
        ? `${port.label} is in use`
        : compatible
            ? `Snap into ${port.label}`
            : dimmed
                ? `${port.label} needs a ${port.signal} module`
                : port.label;

    return (
        <g opacity={opacity}>
            <defs>
                <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={occupied ? 0.95 : 0.75} />
                    <stop offset="45%" stopColor={color} stopOpacity={occupied ? 0.7 : 0.45} />
                    <stop offset="100%" stopColor="#1e1b4b" stopOpacity={0.92} />
                </linearGradient>
                <linearGradient id={`${gid}-well`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#020617" stopOpacity="0.95" />
                    <stop offset="55%" stopColor="#0f172a" stopOpacity="0.85" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.35" />
                </linearGradient>
                <linearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
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
                <path
                    d={notchPath(JACK.w, JACK.h)}
                    fill="#020617"
                    opacity={0.5}
                    transform="translate(2.5, 4)"
                />

                {/* Molded plastic body */}
                <path
                    d={notchPath(JACK.w, JACK.h)}
                    fill={`url(#${gid}-body)`}
                    stroke={color}
                    strokeWidth={occupied ? 2.6 : 2}
                    filter="url(#socketPop)"
                />

                {/* Top bevel highlight */}
                <path
                    d={notchPath(JACK.w, JACK.h)}
                    fill={`url(#${gid}-shine)`}
                    style={{pointerEvents: 'none'}}
                />

                {/* Deep socket well */}
                <rect
                    x={7}
                    y={(JACK.h / 2) - 8}
                    width={JACK.w - 12}
                    height={16}
                    rx={6}
                    fill={`url(#${gid}-well)`}
                    stroke="#000"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                />
                {/* Inner lip */}
                <rect
                    x={9}
                    y={(JACK.h / 2) - 5}
                    width={JACK.w - 16}
                    height={3}
                    rx={1.5}
                    fill="#ffffff"
                    opacity={0.12}
                />
                {/* Gold contacts — run along the PCB edge (across the jack mouth) */}
                {[0, 1, 2].map(i => {
                    const sideEdge = port.side === 'left' || port.side === 'right';
                    if (sideEdge) {
                        // Vertical pads stacked along the vertical board edge
                        return (
                            <rect
                                key={i}
                                x={13}
                                y={(JACK.h / 2) - 9 + (i * 6)}
                                width={2.8}
                                height={5}
                                rx={1.2}
                                fill="#fbbf24"
                                stroke="#b45309"
                                strokeWidth={0.6}
                            />
                        );
                    }
                    // Horizontal local pads → vertical pins along top/bottom edges after rotate
                    return (
                        <rect
                            key={i}
                            x={11}
                            y={(JACK.h / 2) - 8 + (i * 5.5)}
                            width={12}
                            height={2.8}
                            rx={1.2}
                            fill="#fbbf24"
                            stroke="#b45309"
                            strokeWidth={0.6}
                        />
                    );
                })}
            </g>

            {/* Floating label chip */}
            <g style={{pointerEvents: 'none'}}>
                <rect
                    x={labelG.anchor === 'middle' ? labelG.x - 16 : (labelG.anchor === 'end' ? labelG.x - 30 : labelG.x - 2)}
                    y={labelG.y - 12}
                    width={32}
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
        </g>
    );
};

export default Port;
