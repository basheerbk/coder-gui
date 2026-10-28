import React from 'react';

import {BOARD, DEPTH} from '../../domain/ports';
import {
    ANTENNA_H,
    BUTTONS,
    HEADER,
    HOLES,
    LEDS,
    LED_LABEL,
    MOD,
    MODULE_PADS,
    PAD_LEFT,
    PAD_RIGHT,
    PASSIVES,
    TRACES,
    U1,
    U4,
    USB,
    padY,
    passiveSize
} from '../../domain/boardLayout';

/** Top-down drawing of the real Maker ESP32 board, in board-local units (0..BOARD.w, 0..BOARD.h). */

const SILK = '#1d1d1b';
const SILK_FONT = '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
const GLOW_HEXES = ['ff2828', '288cff', '28dc6e'];

const ledAnimation = (led, anyLinked) => {
    if (led.mode === 'heartbeat') {
        return 'tbBeat 1.4s ease-in-out infinite';
    }
    if (led.mode === 'activity' && anyLinked) {
        return 'tbDotBlink 0.9s ease-in-out infinite';
    }
    return null;
};

const Silk = ({x, y, size = 7, anchor = 'middle', children}) => (
    <text
        x={x}
        y={y}
        fill={SILK}
        fontFamily={SILK_FONT}
        fontWeight={600}
        fontSize={size}
        textAnchor={anchor}
        dominantBaseline="middle"
    >
        {children}
    </text>
);

const Rect = ({r, fill, rx}) => (
    <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={rx}
        fill={fill}
    />
);

const Pad = ({x, y, w, h}) => (
    <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="url(#baPad)"
    />
);

/** Tiny SMD resistor/capacitor: metal end caps around a body. */
const Passive = ({x, y, kind, horizontal}) => {
    const {w, h} = passiveSize(horizontal);
    const body = kind === 'C' ? '#b08657' : '#161616';
    const cap = horizontal ? {w: 2.5, h} : {w, h: 2.5};
    return (
        <g>
            <rect
                x={x - (w / 2) + 0.6}
                y={y - (h / 2) + 0.8}
                width={w}
                height={h}
                fill="rgba(0,0,0,0.12)"
            />
            <rect
                x={x - (w / 2)}
                y={y - (h / 2)}
                width={w}
                height={h}
                rx={0.6}
                fill={body}
            />
            <rect
                x={x - (w / 2)}
                y={y - (h / 2)}
                width={cap.w}
                height={cap.h}
                fill="#d2d3d0"
            />
            <rect
                x={horizontal ? x + (w / 2) - cap.w : x - (w / 2)}
                y={horizontal ? y - (h / 2) : y + (h / 2) - cap.h}
                width={cap.w}
                height={cap.h}
                fill="#d2d3d0"
            />
        </g>
    );
};

const Led = ({led, animation}) => (
    <g>
        <rect
            x={led.x - 3.5}
            y={led.y - 5}
            width={7}
            height={10}
            rx={1}
            fill="#f1efe8"
            stroke="#d8d4c8"
            strokeWidth={0.6}
        />
        <circle
            cx={led.x}
            cy={led.y}
            r={8}
            fill={`url(#baGlow-${led.color.replace('#', '')})`}
            className={animation ? 'tb-led-beat' : null}
            style={animation ? {animation} : null}
        />
        <circle
            cx={led.x}
            cy={led.y}
            r={2.2}
            fill={led.color}
        />
    </g>
);

const TactileButton = ({x, y}) => (
    <g>
        <rect
            x={x - 9}
            y={y - 7}
            width={18}
            height={14}
            rx={1.5}
            fill="url(#baButton)"
            stroke="#8d8f91"
            strokeWidth={0.6}
        />
        <circle
            cx={x}
            cy={y}
            r={4.6}
            fill="url(#baButtonCap)"
        />
    </g>
);

/** Gradients shared by the flat board and the 3D board's top face. */
const BoardDefs = () => (
    <defs>
        <linearGradient id="baMask" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbfbf8" />
            <stop offset="100%" stopColor="#ebebe6" />
        </linearGradient>
        <linearGradient id="baPad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eeeeeb" />
            <stop offset="100%" stopColor="#a8a9a5" />
        </linearGradient>
        <linearGradient id="baCan" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ddd9cf" />
            <stop offset="55%" stopColor="#b9b4a8" />
            <stop offset="100%" stopColor="#d0ccc2" />
        </linearGradient>
        <linearGradient id="baUsb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6e7e8" />
            <stop offset="50%" stopColor="#a9acaf" />
            <stop offset="100%" stopColor="#d4d6d8" />
        </linearGradient>
        <linearGradient id="baButton" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d9dadb" />
            <stop offset="100%" stopColor="#9fa1a3" />
        </linearGradient>
        <radialGradient id="baButtonCap" cx="0.38" cy="0.34" r="0.7">
            <stop offset="0%" stopColor="#7a6153" />
            <stop offset="100%" stopColor="#3d2e27" />
        </radialGradient>
        <radialGradient id="baHole" cx="0.4" cy="0.4" r="0.7">
            <stop offset="0%" stopColor="#9c9c98" />
            <stop offset="70%" stopColor="#7d7d79" />
            <stop offset="100%" stopColor="#5d5d5a" />
        </radialGradient>
        <radialGradient id="baDrill" cx="0.6" cy="0.6" r="0.6">
            <stop offset="0%" stopColor="#2a2a28" />
            <stop offset="100%" stopColor="#5a5a56" />
        </radialGradient>
        {GLOW_HEXES.map(hex => (
            <radialGradient
                key={hex}
                id={`baGlow-${hex}`}
            >
                <stop offset="0%" stopColor={`#${hex}`} stopOpacity="0.6" />
                <stop offset="35%" stopColor={`#${hex}`} stopOpacity="0.25" />
                <stop offset="100%" stopColor={`#${hex}`} stopOpacity="0" />
            </radialGradient>
        ))}
        <pattern id="baBrush" width="6" height="2" patternUnits="userSpaceOnUse">
            <rect width="6" height="1" fill="rgba(255,255,255,0.12)" />
        </pattern>
    </defs>
);

/**
 * Everything printed or etched on the board itself: solder mask, copper, live pulses,
 * pads, holes and silkscreen. This is also the 3D board's top face.
 */
const BoardSurface = ({connected}) => {
    const links = connected || {};
    return (
        <g>
            <rect
                width={BOARD.w}
                height={BOARD.h}
                rx={10}
                fill="url(#baMask)"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={1}
            />

            {/* Copper under the mask: a soft relief */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                <g stroke="rgba(0,0,0,0.07)" strokeWidth={3.6} transform="translate(0.7 0.9)">
                    {TRACES.map(t => <path key={t.id} d={t.d} />)}
                </g>
                <g stroke="#e3e2d8" strokeWidth={3}>
                    {TRACES.map(t => <path key={t.id} d={t.d} />)}
                </g>
                <g stroke="#ffffff" strokeWidth={0.9} opacity={0.9} transform="translate(-0.5 -0.6)">
                    {TRACES.map(t => <path key={t.id} d={t.d} />)}
                </g>
            </g>

            {/* Live links: tint the trace and run a pulse in the direction data flows */}
            {TRACES.filter(t => links[t.id]).map(t => {
                const link = links[t.id];
                return (
                    <g key={`live-${t.id}`} fill="none" strokeLinecap="round">
                        <path
                            d={t.d}
                            stroke={link.color}
                            strokeWidth={2.2}
                            opacity={0.45}
                        />
                        <path
                            d={link.dir === 'in' ? t.d : t.reverse}
                            pathLength={100}
                            stroke={link.color}
                            strokeWidth={4}
                            strokeDasharray="12 100"
                            className="tb-trace-pulse"
                            style={{animation: 'tbTrace 1.6s linear infinite'}}
                        />
                    </g>
                );
            })}

            {HOLES.map(([hx, hy]) => (
                <g key={`${hx}-${hy}`}>
                    <circle cx={hx} cy={hy} r={8.5} fill="#d9d9d4" />
                    <circle cx={hx} cy={hy} r={7} fill="url(#baHole)" />
                </g>
            ))}

            {/* Pads the ESP32 module is soldered to */}
            {Array.from({length: MODULE_PADS}).map((_, k) => (
                <React.Fragment key={`mp-${k}`}>
                    <Pad x={PAD_LEFT - 6} y={padY(k) - 2} w={8} h={4} />
                    <Pad x={PAD_RIGHT - 2} y={padY(k) - 2} w={8} h={4} />
                    <Pad x={MOD.x + 10 + (k * 10) - 2} y={MOD.y + MOD.h - 2} w={4} h={7} />
                </React.Fragment>
            ))}

            {/* 5V / GND / 3.3V header (through-holes) */}
            {HEADER.rows.map(([label, hy]) => (
                <g key={label}>
                    <rect
                        x={HEADER.box.x}
                        y={hy - 5.5}
                        width={HEADER.box.w}
                        height={11}
                        fill="none"
                        stroke={SILK}
                        strokeWidth={0.6}
                    />
                    {HEADER.pinXs.map(hx => (
                        <g key={hx}>
                            <circle cx={hx} cy={hy} r={3.6} fill="url(#baPad)" />
                            <circle cx={hx} cy={hy} r={1.5} fill="url(#baDrill)" />
                        </g>
                    ))}
                    <Silk x={HEADER.labelX} y={hy} anchor="end">{label}</Silk>
                </g>
            ))}

            <Silk x={U1.label.x} y={U1.label.y}>U1</Silk>
            <Silk x={U4.label.x} y={U4.label.y}>U4</Silk>
            <Silk x={LED_LABEL.x} y={LED_LABEL.y} size={6.5}>PWR</Silk>
            {BUTTONS.map(b => (
                <Silk key={b.label} x={b.x} y={b.y + 14} size={7.5}>{b.label}</Silk>
            ))}
            <Silk x={USB.label.x} y={USB.label.y}>USB</Silk>
        </g>
    );
};

/** Components soldered on top of the board, drawn flat for the edit view. */
const BoardParts = ({connected}) => {
    const anyLinked = Object.keys(connected || {}).length > 0;
    return (
        <g>
            {/* ESP32 module: black module PCB with castellations, antenna, metal shield can */}
            <rect
                x={MOD.x + 2}
                y={MOD.y + 4}
                width={MOD.w}
                height={MOD.h}
                fill="rgba(0,0,0,0.22)"
            />
            <rect
                x={MOD.x}
                y={MOD.y}
                width={MOD.w}
                height={MOD.h}
                fill="#141414"
                stroke="#2a2a2a"
                strokeWidth={1}
            />
            <path
                d={`M${MOD.x + 10},${MOD.y + 8} H${MOD.x + MOD.w - 10} M${MOD.x + 10},${MOD.y + 8} V${MOD.y + 32}
                    M${MOD.x + 20},${MOD.y + 8} V${MOD.y + 28} H${MOD.x + 28} V${MOD.y + 14} H${MOD.x + 36}
                    V${MOD.y + 28} H${MOD.x + 44} V${MOD.y + 14} H${MOD.x + 52} V${MOD.y + 28} H${MOD.x + 60}
                    V${MOD.y + 14} H${MOD.x + 68} V${MOD.y + 28} H${MOD.x + 76} V${MOD.y + 14} H${MOD.x + 84} V${MOD.y + 28}`}
                fill="none"
                stroke="#262626"
                strokeWidth={2.4}
            />
            {Array.from({length: MODULE_PADS}).map((_, k) => (
                <React.Fragment key={`mc-${k}`}>
                    <path d={`M${MOD.x},${padY(k) - 2.5} A2.5,2.5 0 0 1 ${MOD.x},${padY(k) + 2.5} Z`} fill="#c9a34c" />
                    <path
                        d={`M${MOD.x + MOD.w},${padY(k) - 2.5} A2.5,2.5 0 0 0 ${MOD.x + MOD.w},${padY(k) + 2.5} Z`}
                        fill="#c9a34c"
                    />
                    <path
                        d={`M${MOD.x + 10 + (k * 10) - 2.5},${MOD.y + MOD.h} A2.5,2.5 0 0 1 ${MOD.x + 10 + (k * 10) + 2.5},${MOD.y + MOD.h} Z`}
                        fill="#c9a34c"
                    />
                </React.Fragment>
            ))}
            <rect
                x={MOD.x + 4}
                y={MOD.y + ANTENNA_H + 2}
                width={MOD.w - 8}
                height={MOD.h - ANTENNA_H - 8}
                rx={2}
                fill="url(#baCan)"
            />
            <rect
                x={MOD.x + 4}
                y={MOD.y + ANTENNA_H + 2}
                width={MOD.w - 8}
                height={MOD.h - ANTENNA_H - 8}
                rx={2}
                fill="url(#baBrush)"
                stroke="rgba(0,0,0,0.2)"
                strokeWidth={0.8}
            />
            <text
                x={MOD.x + 14}
                y={MOD.y + ANTENNA_H + 26}
                fill="#3a3832"
                fontFamily='"Chakra Petch", "Arial Narrow", system-ui, sans-serif'
                fontWeight={700}
                fontSize={17}
                letterSpacing={0.5}
            >
                ESP32
            </text>
            <circle cx={MOD.x + 14} cy={MOD.y + MOD.h - 18} r={2.4} fill="#1a1a1a" />

            {PASSIVES.map(([px, py, kind, horizontal]) => (
                <Passive key={`p-${px}-${py}`} x={px} y={py} kind={kind} horizontal={horizontal} />
            ))}

            {U1.legs.map(leg => <Rect key={`u1-${leg.x}`} r={leg} fill="#c9ccce" />)}
            <Rect r={U1.tab} fill="#c9ccce" />
            <Rect r={U1.body} rx={1.5} fill="#1a1b1d" />

            {U4.legs.map(leg => <Rect key={`u4-${leg.x}-${leg.y}`} r={leg} fill="#c9ccce" />)}
            <Rect r={U4.body} rx={1.5} fill="#1a1b1d" />
            <circle cx={U4.dot.x} cy={U4.dot.y} r={1.6} fill="#0a0a0b" />

            {LEDS.map(led => (
                <Led key={led.mode} led={led} animation={ledAnimation(led, anyLinked)} />
            ))}

            {BUTTONS.map(b => <TactileButton key={b.label} x={b.x} y={b.y} />)}

            <rect x={USB.x} y={USB.y} width={USB.w} height={USB.h} rx={3} fill="url(#baUsb)" />
            <rect x={USB.x} y={USB.y} width={USB.w} height={USB.h} rx={3} fill="url(#baBrush)" />
            <line x1={USB.x + 4} y1={USB.y + 14} x2={USB.x + USB.w - 4} y2={USB.y + 14} stroke="rgba(0,0,0,0.22)" />
            <rect
                x={USB.x + 7}
                y={USB.y + 30}
                width={USB.w - 14}
                height={11}
                rx={5.5}
                fill="#141516"
                stroke="#8d9093"
                strokeWidth={1}
            />
        </g>
    );
};

/** Flat board for the edit view: FR-4 edge, surface and parts. */
const BoardArt = ({connected}) => (
    <g transform={`translate(${BOARD.x}, ${BOARD.y})`}>
        <BoardDefs />
        <rect
            x={DEPTH.x}
            y={DEPTH.y}
            width={BOARD.w}
            height={BOARD.h}
            rx={10}
            fill="#d7cca4"
            stroke="#bfb38a"
            strokeWidth={1}
            filter="url(#boardShadow)"
        />
        <BoardSurface connected={connected} />
        <BoardParts connected={connected} />
    </g>
);

export {BoardDefs, BoardSurface, BoardParts, ledAnimation};
export default BoardArt;
