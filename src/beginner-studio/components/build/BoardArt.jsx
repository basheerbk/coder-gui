import React from 'react';

import {BOARD_ART} from '../../assets/hub';
import {HUB_SCALE, LEDS, TRACES} from '../../domain/boardLayout';
import {BOARD} from '../../domain/ports';

/** Top-down RJ11 Hub: the exported artwork plus the parts that animate, in world units from the board's corner. */

const GLOW_HEXES = ['ff2828', '288cff', '28dc6e'];
const PCB_EDGE = '#341656';

const ledAnimation = (led, anyLinked) => {
    if (led.mode === 'heartbeat') {
        return 'tbBeat 1.4s ease-in-out infinite';
    }
    if (led.mode === 'activity' && anyLinked) {
        return 'tbDotBlink 0.9s ease-in-out infinite';
    }
    return null;
};

const BoardDefs = () => (
    <defs>
        {GLOW_HEXES.map(hex => (
            <radialGradient
                key={hex}
                id={`baGlow-${hex}`}
            >
                <stop offset="0%" stopColor={`#${hex}`} stopOpacity="0.7" />
                <stop offset="35%" stopColor={`#${hex}`} stopOpacity="0.3" />
                <stop offset="100%" stopColor={`#${hex}`} stopOpacity="0" />
            </radialGradient>
        ))}
    </defs>
);

/** Live links (hub units): tint the jack's traces and run a pulse in the direction data flows. */
const LiveTraces = ({connected}) => TRACES.filter(t => connected[t.id]).map(t => {
    const link = connected[t.id];
    return (
        <g key={`live-${t.id}`} fill="none" strokeLinecap="round">
            {t.lines.map(line => (
                <React.Fragment key={line.d}>
                    <path
                        d={line.d}
                        stroke={link.color}
                        strokeWidth={4}
                        opacity={0.5}
                    />
                    <path
                        d={link.dir === 'in' ? line.d : line.reverse}
                        pathLength={100}
                        stroke={link.color}
                        strokeWidth={7}
                        strokeDasharray="12 100"
                        className="tb-trace-pulse"
                        style={{animation: 'tbTrace 1.6s linear infinite'}}
                    />
                </React.Fragment>
            ))}
        </g>
    );
});

/** Glow over each status LED (hub units); the artwork has the LED bodies. */
const LedGlows = ({anyLinked}) => LEDS.map(led => {
    const animation = ledAnimation(led, anyLinked);
    const idle = led.mode === 'activity' && !anyLinked;
    return (
        <circle
            key={led.mode}
            cx={led.x}
            cy={led.y}
            r={16}
            fill={`url(#baGlow-${led.color.replace('#', '')})`}
            opacity={idle ? 0.25 : 1}
            className={animation ? 'tb-led-beat' : null}
            style={animation ? {animation} : null}
        />
    );
});

/** The hub's top face: artwork, live traces and LED glows. Also the CSS 3D board's top face. */
const BoardTop = ({connected}) => {
    const links = connected || {};
    const [x, y, w, h] = BOARD_ART.box;
    return (
        <g>
            <BoardDefs />
            <image
                xlinkHref={BOARD_ART.src}
                x={x}
                y={y}
                width={w}
                height={h}
                preserveAspectRatio="none"
            />
            <g transform={`scale(${HUB_SCALE})`}>
                <LiveTraces connected={links} />
                <LedGlows anyLinked={Object.keys(links).length > 0} />
            </g>
        </g>
    );
};

/** Flat board for the edit view: PCB edge with its shadow, then the top. */
const BoardArt = ({connected}) => (
    <g transform={`translate(${BOARD.x}, ${BOARD.y})`}>
        <rect
            x={2}
            y={5}
            width={BOARD.w}
            height={BOARD.h}
            rx={3}
            fill={PCB_EDGE}
            filter="url(#boardShadow)"
        />
        <BoardTop connected={connected} />
    </g>
);

export {BoardTop, ledAnimation, PCB_EDGE};
export default BoardArt;
