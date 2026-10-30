import React from 'react';

import {portColor} from '../../domain/ports';
import {useStudio} from '../../context/StudioContext.jsx';

/** Turns the jack drawing (mouth on its west edge) to face the edge the plug enters from. */
const OPEN_ROTATE = {W: 0, E: 180, N: 90, S: -90};

const labelWidth = port => Math.max(32, (String(port.label).length * 8) + 14);

/** Coloured name chip centred on (cx, cy). */
const PortLabel = ({port, cx, cy, color, K, opacity = 1}) => {
    const chipW = labelWidth(port);
    return (
        <g
            opacity={opacity}
            style={{pointerEvents: 'none'}}
        >
            <rect
                x={cx - (chipW / 2)}
                y={cy - 8}
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
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill={color}
                fontSize={11}
                fontWeight={800}
            >
                {port.label}
            </text>
        </g>
    );
};

/** Where a port's label chip goes: on the jack's housing, or on the ESP32's shield can. */
const labelCenter = (port, pos) => {
    const fp = pos.footprint;
    if (port.kind === 'onboard') {
        return {cx: fp.x + (fp.w / 2), cy: fp.y + fp.d - 16};
    }
    return {cx: fp.x + (fp.w / 2), cy: fp.y + (fp.d / 2)};
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

/** RJ11 housing seen from above, D deep × Wd across, mouth at x = 0, in its own units. */
const JackArt = ({gid, D, Wd, color, occupied}) => {
    const contactYs = [0, 1, 2, 3, 4, 5].map(i => (Wd * 0.28) + (i * ((Wd * 0.44) / 5)));
    return (
        <g>
            <defs>
                <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2c2c2c" />
                    <stop offset="100%" stopColor="#0c0c0c" />
                </linearGradient>
            </defs>
            <rect x={2} y={3.5} width={D} height={Wd} rx={3.5} fill="#020617" opacity={0.35} />
            <rect
                width={D}
                height={Wd}
                rx={3.5}
                fill={`url(#${gid}-body)`}
                stroke={occupied ? color : '#000'}
                strokeWidth={occupied ? 2 : 0.8}
                filter="url(#socketPop)"
            />
            <rect x={D - 4.5} y={3} width={2.5} height={Wd - 6} rx={1.2} fill={color} opacity={0.9} />
            <rect width={4} height={Wd} rx={2} fill="#2f2f2f" />
            <rect
                x={4}
                y={Wd * 0.2}
                width={D * 0.6}
                height={Wd * 0.6}
                rx={1.5}
                fill="#050505"
                stroke="#1f1f1f"
                strokeWidth={0.8}
            />
            <rect
                x={D * 0.7}
                y={Wd * 0.12}
                width={D * 0.12}
                height={Wd * 0.76}
                rx={1}
                fill="#151515"
                stroke="#2c2c2c"
                strokeWidth={0.6}
            />
            <line x1={5} y1={1.6} x2={D - 6} y2={1.6} stroke="#3a3a3a" strokeWidth={1} />
            {contactYs.map(cy => (
                <g key={cy}>
                    <path
                        d={`M 6 ${cy} L ${(D * 0.6) - 2} ${cy} L ${D * 0.6} ${cy + 2}`}
                        fill="none"
                        stroke="#b88f37"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d={`M 6 ${cy - 0.4} L ${(D * 0.6) - 2} ${cy - 0.4}`}
                        stroke="#f5dc93"
                        strokeWidth={0.5}
                        strokeLinecap="round"
                    />
                </g>
            ))}
        </g>
    );
};

/** Transform that places JackArt (D × Wd) on a footprint, mouth towards `open`. */
const jackTransform = ({footprint: fp, D, Wd, open}) => (
    `translate(${fp.x + (fp.w / 2)}, ${fp.y + (fp.d / 2)}) rotate(${OPEN_ROTATE[open] || 0}) translate(${-D / 2}, ${-Wd / 2})`
);

/** A hub jack with no studio port: drawn so the board looks complete, never interactive. */
const SpareJack = ({jack}) => (
    <g
        transform={jackTransform(jack)}
        opacity={0.85}
        style={{pointerEvents: 'none'}}
    >
        <JackArt gid={`spare-${jack.id}`} D={jack.D} Wd={jack.Wd} color="#6b7280" />
    </g>
);

const Port = ({
    port,
    pos,
    occupied,
    compatible,
    dimmed,
    flashing,
    onClick
}) => {
    const {K} = useStudio();
    const color = portColor(port, K);
    const opacity = occupied || compatible ? 1 : (dimmed ? 0.2 : 0.92);
    const title = portTitle(port, {occupied, compatible, dimmed});
    const fp = pos.footprint;
    const onboard = port.kind === 'onboard';
    const label = labelCenter(port, pos);
    const handlers = {
        style: {cursor: compatible ? 'pointer' : (dimmed ? 'not-allowed' : 'grab')},
        onPointerDown: e => e.stopPropagation(),
        onClick: e => {
            e.stopPropagation();
            onClick();
        }
    };
    const flash = flashing ? (
        <circle cx={fp.x + (fp.w / 2)} cy={fp.y + (fp.d / 2)} r={14} fill="none" stroke={color} strokeWidth={2.4}>
            <animate attributeName="r" from="12" to={onboard ? 48 : 30} dur="0.4s" fill="freeze" />
            <animate attributeName="opacity" from="1" to="0" dur="0.4s" fill="freeze" />
        </circle>
    ) : null;

    if (onboard) {
        const lit = compatible || occupied;
        return (
            <g opacity={opacity}>
                <g {...handlers}>
                    <title>{title}</title>
                    <rect
                        x={fp.x - 4}
                        y={fp.y - 4}
                        width={fp.w + 8}
                        height={fp.d + 8}
                        rx={6}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={lit ? 2.4 : 1.2}
                        strokeDasharray={lit ? null : '5 4'}
                        opacity={lit ? 0.9 : 0.6}
                        filter={compatible ? 'url(#cableGlow)' : null}
                    >
                        {compatible ? (
                            <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
                        ) : null}
                    </rect>
                    {flash}
                </g>
                <PortLabel port={port} cx={label.cx} cy={label.cy} color={color} K={K} />
            </g>
        );
    }

    return (
        <g opacity={opacity}>
            <g {...handlers}>
                <title>{title}</title>
                <rect x={fp.x - 8} y={fp.y - 8} width={fp.w + 16} height={fp.d + 16} fill="transparent" />
                {compatible ? (
                    <rect
                        x={fp.x - 5}
                        y={fp.y - 5}
                        width={fp.w + 10}
                        height={fp.d + 10}
                        rx={9}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.4}
                        opacity={0.85}
                        filter="url(#cableGlow)"
                    >
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
                    </rect>
                ) : null}
                {flash}
                <g transform={jackTransform(pos)}>
                    <JackArt gid={`sock-${port.id}`} D={pos.D} Wd={pos.Wd} color={color} occupied={occupied} />
                </g>
            </g>
            <PortLabel port={port} cx={label.cx} cy={label.cy} color={color} K={K} />
        </g>
    );
};

export {PortLabel, SpareJack, labelCenter, labelWidth, portTitle};
export default Port;
