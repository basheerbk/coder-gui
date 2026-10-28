import React from 'react';

import {JACK, portColor, portPosition} from '../../../domain/ports';
import {portTitle} from '../Port.jsx';

import {Box, FaceSvg} from './Box.jsx';

/** Housing height in board units (the flat view's jack is 30 deep × 36 across). */
const JACK_H = 16;
const OPEN = {left: 'W', right: 'E', top: 'N', bottom: 'S'};

/** Top of the housing, mouth at x = 0, D deep and Wd across. Matches the flat Port drawing. */
const JackTop = ({D, Wd, color}) => (
    <g>
        <rect width={4} height={Wd} rx={2} fill="#2f2f2f" />
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
        <rect
            x={D - 4.5}
            y={3}
            width={2.5}
            height={Wd - 6}
            rx={1.2}
            fill={color}
            opacity={0.9}
        />
        <line x1={5} y1={1.6} x2={D - 6} y2={1.6} stroke="#3a3a3a" strokeWidth={1} />
        <line x1={5} y1={Wd - 1.6} x2={D - 6} y2={Wd - 1.6} stroke="#050505" strokeWidth={1} />
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
        {[0, 1, 2, 3, 4, 5].map(i => {
            const cy = (Wd * 0.28) + (i * ((Wd * 0.44) / 5));
            return (
                <g key={i}>
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
            );
        })}
    </g>
);

/** The mouth the plug goes into, Wd across and H tall. */
const JackFront = ({Wd, H}) => (
    <g>
        <rect
            x={Wd * 0.18}
            y={H * 0.16}
            width={Wd * 0.64}
            height={H * 0.6}
            rx={1.2}
            fill="#030303"
        />
        <rect
            x={Wd * 0.4}
            y={H * 0.74}
            width={Wd * 0.2}
            height={H * 0.14}
            fill="#030303"
        />
        <line x1={0} y1={0.5} x2={Wd} y2={0.5} stroke="#3a3a3a" strokeWidth={1} />
        {[0, 1, 2, 3, 4, 5].map(i => {
            const x = (Wd * 0.29) + (i * ((Wd * 0.42) / 5));
            return (
                <path
                    key={i}
                    d={`M${x},${H * 0.17} L${x},${H * 0.3} L${x + 0.6},${H * 0.4}`}
                    fill="none"
                    stroke="#c99d3e"
                    strokeWidth={0.8}
                    strokeLinecap="round"
                />
            );
        })}
    </g>
);

/** Footprint of a jack in world units; top/bottom jacks are the flat jack turned 90°. */
const jackFootprint = port => {
    const pos = portPosition(port);
    if (port.side === 'top' || port.side === 'bottom') {
        const cx = pos.x + (JACK.w / 2);
        const cy = pos.y + (JACK.h / 2);
        return {x: cx - (JACK.h / 2), y: cy - (JACK.w / 2), w: JACK.h, d: JACK.w};
    }
    return {x: pos.x, y: pos.y, w: JACK.w, d: JACK.h};
};

const hlClass = ({compatible, occupied}, flashing) => {
    if (flashing) {
        return 'tb3d-hl tb3d-flash';
    }
    if (compatible) {
        return 'tb3d-hl tb3d-fit';
    }
    return occupied ? 'tb3d-hl' : null;
};

/**
 * RJ11 housing with its mouth on the `open` edge (W/E/N/S). Footprint x, y, w, d; the board
 * jacks and the module sockets are the same part.
 */
const JackBox = ({x, y, w, d, z = 0, open, color, overlay, ...rest}) => {
    const sideways = open === 'E' || open === 'W';
    const D = sideways ? w : d;
    const Wd = sideways ? d : w;
    const topT = {
        W: '',
        E: `translate(${D},0) scale(-1,1)`,
        N: 'matrix(0,1,1,0,0,0)',
        S: `matrix(0,-1,1,0,0,${D})`
    }[open];
    const faceT = {
        S: '',
        N: `translate(${Wd},${JACK_H}) rotate(180)`,
        E: 'matrix(0,1,1,0,0,0)',
        W: `matrix(0,1,-1,0,${JACK_H},0)`
    }[open];

    const faces = {
        t: {
            bg: 'linear-gradient(135deg, #2c2c2c, #0c0c0c)',
            radius: 'calc(3.5 * var(--u))',
            content: (
                <React.Fragment>
                    <FaceSvg w={w} h={d}>
                        <g transform={topT}>
                            <JackTop D={D} Wd={Wd} color={color} />
                        </g>
                    </FaceSvg>
                    {overlay}
                </React.Fragment>
            )
        },
        s: {bg: 'linear-gradient(#262626, #121212)'},
        n: {bg: '#0d0d0d'},
        e: {bg: 'linear-gradient(90deg, #1b1b1b, #101010)'},
        w: {bg: 'linear-gradient(90deg, #1b1b1b, #101010)'}
    };
    faces[open.toLowerCase()] = {
        bg: 'linear-gradient(#262626, #0e0e0e)',
        content: (
            <FaceSvg w={sideways ? JACK_H : Wd} h={sideways ? Wd : JACK_H}>
                <g transform={faceT}>
                    <JackFront Wd={Wd} H={JACK_H} />
                </g>
            </FaceSvg>
        )
    };

    return (
        <Box
            x={x}
            y={y}
            w={w}
            d={d}
            h={JACK_H}
            z={z}
            faces={faces}
            {...rest}
        />
    );
};

const Jack3D = ({port, state, flashing, K}) => {
    const fp = jackFootprint(port);
    const color = portColor(port, K);
    const hl = hlClass(state, flashing);
    const ring = flashing || state.compatible
        ? `0 0 0 calc(1.6 * var(--u)) ${color}, 0 0 calc(12 * var(--u)) calc(3 * var(--u)) ${color}88`
        : `0 0 0 calc(1.2 * var(--u)) ${color}`;
    return (
        <JackBox
            x={fp.x}
            y={fp.y}
            w={fp.w}
            d={fp.d}
            open={OPEN[port.side] || 'W'}
            color={color}
            overlay={hl ? <div className={hl} style={{boxShadow: ring}} /> : null}
            className={state.dimmed ? 'tb3d-jack tb3d-dim' : 'tb3d-jack'}
            data-port={port.id}
            role="button"
            aria-label={`${port.label} port`}
            title={portTitle(port, state)}
        />
    );
};

export {JACK_H, OPEN, JackBox, JackFront, JackTop, jackFootprint};
export default Jack3D;
