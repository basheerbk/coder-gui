import React from 'react';

import {
    ANTENNA_H,
    BUTTONS,
    LEDS,
    MOD,
    MODULE_PADS,
    PASSIVES,
    U1,
    U4,
    USB,
    padY,
    passiveSize
} from '../../../domain/boardLayout';
import {ledAnimation} from '../BoardArt.jsx';

import {Box, Disc, FaceSvg, sides} from './Box.jsx';

/** Components soldered on the board, as 3D boxes in board-local units. */

const GOLD = '#c9a34c';
const METAL = '#c9ccce';
const METAL_SIDES = sides('linear-gradient(#d3cfc5, #9e998e)', 'linear-gradient(90deg, #c2bdb2, #99948a)', '#8f8a80');
const BLACK_SIDES = sides('linear-gradient(#232426, #141516)', '#151617', '#101112');
const LEG_SIDES = sides('#a9acae', '#b8bbbd');

const CAN = {x: MOD.x + 4, y: MOD.y + ANTENNA_H + 2, w: MOD.w - 8, d: MOD.h - ANTENNA_H - 8};
const MOD_H = 3;
const CAN_H = 5;

const castX = k => 10 + (k * 10);
const castY = k => padY(k) - MOD.y;

const ModuleTop = () => (
    <FaceSvg w={MOD.w} h={MOD.h}>
        <rect width={MOD.w} height={MOD.h} fill="#141414" />
        <path
            d={`M10,8 H${MOD.w - 10} M10,8 V32 M20,8 V28 H28 V14 H36 V28 H44 V14
                H52 V28 H60 V14 H68 V28 H76 V14 H84 V28`}
            fill="none"
            stroke="#262626"
            strokeWidth={2.4}
        />
        <rect width={MOD.w} height={MOD.h} fill="none" stroke="#2a2a2a" strokeWidth={1} />
        {Array.from({length: MODULE_PADS}).map((_, k) => (
            <React.Fragment key={k}>
                <path d={`M0,${castY(k) - 2.5} A2.5,2.5 0 0 1 0,${castY(k) + 2.5} Z`} fill={GOLD} />
                <path d={`M${MOD.w},${castY(k) - 2.5} A2.5,2.5 0 0 0 ${MOD.w},${castY(k) + 2.5} Z`} fill={GOLD} />
                <path d={`M${castX(k) - 2.5},${MOD.h} A2.5,2.5 0 0 1 ${castX(k) + 2.5},${MOD.h} Z`} fill={GOLD} />
            </React.Fragment>
        ))}
    </FaceSvg>
);

/** Module edge with half-hole castellations: along the long sides (vertical) or the bottom. */
const Castellations = ({vertical}) => {
    const len = vertical ? MOD.h : MOD.w;
    return (
        <FaceSvg w={vertical ? MOD_H : len} h={vertical ? len : MOD_H}>
            <rect width={vertical ? MOD_H : len} height={vertical ? len : MOD_H} fill="#151515" />
            {Array.from({length: MODULE_PADS}).map((_, k) => (vertical ? (
                <rect key={k} x={0} y={castY(k) - 2} width={MOD_H} height={4} fill={GOLD} />
            ) : (
                <rect key={k} x={castX(k) - 2} y={0} width={4} height={MOD_H} fill={GOLD} />
            )))}
        </FaceSvg>
    );
};

const CanTop = () => (
    <FaceSvg w={CAN.w} h={CAN.d}>
        <rect width={CAN.w} height={CAN.d} rx={2} fill="url(#baCan)" />
        <rect
            width={CAN.w}
            height={CAN.d}
            rx={2}
            fill="url(#baBrush)"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth={0.8}
        />
        <text
            x={10}
            y={24}
            fill="#3a3832"
            fontFamily='"Chakra Petch", "Arial Narrow", system-ui, sans-serif'
            fontWeight={700}
            fontSize={17}
            letterSpacing={0.5}
        >
            ESP32
        </text>
        <circle cx={10} cy={MOD.h - 18 - (ANTENNA_H + 2)} r={2.4} fill="#1a1a1a" />
    </FaceSvg>
);

const chipTop = (w, d, dot) => (
    <FaceSvg w={w} h={d}>
        <rect width={w} height={d} rx={1.5} fill="#1a1b1d" />
        <rect width={w} height={d} rx={1.5} fill="none" stroke="rgba(255,255,255,0.06)" />
        {dot ? <circle cx={dot.x} cy={dot.y} r={1.6} fill="#0a0a0b" /> : null}
    </FaceSvg>
);

/** Chip legs are drawn flat on the board top: as boxes they cost a layer each and are barely visible. */
const ChipLegs = () => (
    <g fill={METAL}>
        {U1.legs.concat(U4.legs).map(r => (
            <rect
                key={`${r.x}-${r.y}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
            />
        ))}
    </g>
);

const passiveTop = (kind, horizontal) => {
    const dir = horizontal ? '90deg' : '180deg';
    const body = kind === 'C' ? '#b08657' : '#161616';
    return `linear-gradient(${dir}, #d2d3d0 0 22%, ${body} 22% 78%, #d2d3d0 78%)`;
};

const UsbTop = () => (
    <FaceSvg w={USB.w} h={USB.h}>
        <rect width={USB.w} height={USB.h} rx={3} fill="url(#baUsb)" />
        <rect width={USB.w} height={USB.h} rx={3} fill="url(#baBrush)" />
        <line x1={4} y1={14} x2={USB.w - 4} y2={14} stroke="rgba(0,0,0,0.22)" />
        <ellipse cx={USB.w * 0.32} cy={30} rx={3.5} ry={5} fill="rgba(0,0,0,0.12)" />
        <ellipse cx={USB.w * 0.68} cy={30} rx={3.5} ry={5} fill="rgba(0,0,0,0.12)" />
    </FaceSvg>
);

const USB_H = 9;
const UsbFront = () => (
    <FaceSvg w={USB.w} h={USB_H}>
        <rect width={USB.w} height={USB_H} fill="#c9cbcd" />
        <rect
            x={5}
            y={1.6}
            width={USB.w - 10}
            height={USB_H - 3.2}
            rx={(USB_H - 3.2) / 2}
            fill="#141516"
            stroke="#8d9093"
            strokeWidth={0.8}
        />
        <rect x={USB.w * 0.28} y={(USB_H / 2) - 0.9} width={USB.w * 0.44} height={1.8} rx={0.5} fill="#2e3033" />
        {[0, 1, 2, 3, 4, 5].map(i => (
            <rect
                key={i}
                x={(USB.w * 0.31) + (i * 3.4)}
                y={(USB_H / 2) - 0.7}
                width={1.4}
                height={1.4}
                fill="#d6b25a"
            />
        ))}
    </FaceSvg>
);

const Parts3D = ({connected}) => {
    const anyLinked = Object.keys(connected || {}).length > 0;
    return (
        <React.Fragment>
            <Box
                x={MOD.x}
                y={MOD.y}
                w={MOD.w}
                d={MOD.h}
                h={MOD_H}
                faces={{
                    t: {content: <ModuleTop />},
                    s: {content: <Castellations />},
                    e: {content: <Castellations vertical />},
                    w: {content: <Castellations vertical />},
                    n: {bg: '#151515'}
                }}
            />
            <Box
                x={CAN.x}
                y={CAN.y}
                w={CAN.w}
                d={CAN.d}
                h={CAN_H}
                z={MOD_H}
                faces={{t: {content: <CanTop />}, ...METAL_SIDES}}
            />

            {PASSIVES.map(([px, py, kind, horizontal]) => {
                const {w, h} = passiveSize(horizontal);
                const side = kind === 'C' ? '#8a6641' : '#121212';
                return (
                    <Box
                        key={`p-${px}-${py}`}
                        x={px - (w / 2)}
                        y={py - (h / 2)}
                        w={w}
                        d={h}
                        h={kind === 'C' ? 3.2 : 2.4}
                        faces={{t: {bg: passiveTop(kind, horizontal)}, s: {bg: side}, e: {bg: side}}}
                    />
                );
            })}

            <Box
                x={U1.tab.x}
                y={U1.tab.y}
                w={U1.tab.w}
                d={U1.tab.h}
                h={1.6}
                faces={{t: {bg: METAL}, ...LEG_SIDES}}
            />
            <Box
                x={U1.body.x}
                y={U1.body.y}
                w={U1.body.w}
                d={U1.body.h}
                h={5}
                faces={{t: {content: chipTop(U1.body.w, U1.body.h)}, ...BLACK_SIDES}}
            />

            <Box
                x={U4.body.x}
                y={U4.body.y}
                w={U4.body.w}
                d={U4.body.h}
                h={4}
                faces={{
                    t: {content: chipTop(U4.body.w, U4.body.h, {x: U4.dot.x - U4.body.x, y: U4.dot.y - U4.body.y})},
                    ...BLACK_SIDES
                }}
            />

            {LEDS.map(led => {
                const animation = ledAnimation(led, anyLinked) || 'none';
                const rgb = led.color;
                const glow = `radial-gradient(circle, ${rgb}8c 0%, ${rgb}38 30%, ${rgb}00 70%)`;
                return (
                    <Box
                        key={led.mode}
                        x={led.x - 3.5}
                        y={led.y - 5}
                        w={7}
                        d={10}
                        h={2.5}
                        faces={{
                            t: {
                                bg: `radial-gradient(circle at 50% 50%, ${rgb} 0 30%, #f1efe8 32%)`,
                                content: (
                                    <div
                                        className="tb3d-led-glow tb-led-beat"
                                        style={{
                                            background: glow,
                                            animation,
                                            opacity: led.mode === 'activity' && !anyLinked ? 0.15 : 0.9
                                        }}
                                    />
                                )
                            },
                            ...sides('#e8e5dc', '#dcd9d0')
                        }}
                    />
                );
            })}

            {BUTTONS.map(b => (
                <React.Fragment key={b.label}>
                    <Box
                        x={b.x - 9}
                        y={b.y - 7}
                        w={18}
                        d={14}
                        h={4}
                        faces={{
                            t: {bg: 'linear-gradient(135deg, #d9dadb, #9fa1a3)'},
                            ...sides('linear-gradient(#b4b6b8, #8d8f91)', '#9a9c9e')
                        }}
                    />
                    <Disc x={b.x - 4.6} y={b.y - 4.6} size={9.2} z={4} bg="#3a2c25" />
                    <Disc x={b.x - 4.6} y={b.y - 4.6} size={9.2} z={5} bg="#3f3029" />
                    <Disc
                        x={b.x - 4.6}
                        y={b.y - 4.6}
                        size={9.2}
                        z={6}
                        bg="radial-gradient(circle at 38% 34%, #7a6153, #3d2e27 70%)"
                    />
                </React.Fragment>
            ))}

            <Box
                x={USB.x}
                y={USB.y}
                w={USB.w}
                d={USB.h}
                h={USB_H}
                faces={{
                    t: {content: <UsbTop />},
                    s: {bg: '#c9cbcd', content: <UsbFront />},
                    e: {bg: 'linear-gradient(90deg, #b8babc, #8f9295)'},
                    w: {bg: 'linear-gradient(90deg, #8f9295, #b8babc)'},
                    n: {bg: '#9a9da0'}
                }}
            />
        </React.Fragment>
    );
};

export {ChipLegs, ModuleTop, CanTop, UsbTop, UsbFront, chipTop, CAN, MOD_H, CAN_H, USB_H, GOLD};
export default Parts3D;
