import React from 'react';

import {JACK} from '../../../domain/ports';

import {Box, Disc, FaceSvg, sides} from './Box.jsx';
import {JackBox} from './Jack3D.jsx';

/**
 * Plug-in modules as small 3D boards, in world units with the RJ11 socket on the left edge
 * (x = 0) at jackY. Sizes line up with placeModule() so cables meet the socket.
 */

const PCB_H = 1.6;
const SILK_FONT = '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
const PASSIVE_TOP = 'linear-gradient(90deg, #d2d3d0 0 22%, #161616 22% 78%, #d2d3d0 78%)';

/** A flat decal (glow, shadow) floating at height z. */
const Flat = ({x, y, w, h, z, style}) => (
    <div
        style={{
            position: 'absolute',
            left: `calc(${x} * var(--u))`,
            top: `calc(${y} * var(--u))`,
            width: `calc(${w} * var(--u))`,
            height: `calc(${h} * var(--u))`,
            transform: `translateZ(calc(${z} * var(--u)))`,
            pointerEvents: 'none',
            ...style
        }}
    />
);

const Resistor = ({x, y}) => (
    <Box
        x={x}
        y={y}
        w={10}
        d={5}
        h={2.2}
        z={PCB_H}
        faces={{t: {bg: PASSIVE_TOP}, s: {bg: '#121212'}, e: {bg: '#121212'}}}
    />
);

/** Round part built from stacked discs: [size, z, background] from the bottom up. */
const Stack = ({cx, cy, layers}) => layers.map(([size, z, bg]) => (
    <Disc
        key={`${size}-${z}`}
        x={cx - (size / 2)}
        y={cy - (size / 2)}
        size={size}
        z={z}
        bg={bg}
    />
));

/** Discs every `step` from z0 to z1 with `side` showing as the wall, capped by `top`. */
const Cylinder = ({cx, cy, size, z0, z1, step = 1, side, top}) => {
    const layers = [];
    for (let z = z0; z < z1 - 0.01; z += step) {
        layers.push([size, Math.round(z * 100) / 100, side]);
    }
    layers.push([size, z1, top]);
    return <Stack cx={cx} cy={cy} layers={layers} />;
};

const Chip = ({x, y, w, d, h = 2.4}) => (
    <Box
        x={x}
        y={y}
        w={w}
        d={d}
        h={h}
        z={PCB_H}
        faces={{
            t: {bg: 'linear-gradient(135deg, #2a2b2d, #141516)', radius: 'calc(0.6 * var(--u))'},
            ...sides('#151617', '#111213')
        }}
    />
);

/** Blue trimmer potentiometer with a brass adjusting screw. */
const Trimmer = ({x, y}) => (
    <Box
        x={x}
        y={y}
        w={10}
        d={10}
        h={6}
        z={PCB_H}
        faces={{
            t: {
                bg: '#2f6fd6',
                content: (
                    <FaceSvg w={10} h={10}>
                        <circle cx={5} cy={5} r={3.4} fill="#d8b25a" stroke="#9c7a2c" strokeWidth={0.4} />
                        <path d="M3 5 H7 M5 3 V7" stroke="#7a5a1c" strokeWidth={0.8} />
                    </FaceSvg>
                )
            },
            ...sides('#2a62bf', '#2457a8')
        }}
    />
);

const SmdLed = ({x, y, color}) => (
    <Box
        x={x}
        y={y}
        w={4}
        d={3}
        h={1.2}
        z={PCB_H}
        faces={{t: {bg: color}, s: {bg: '#e8e5dc'}, e: {bg: '#dcd9d0'}}}
    />
);

const LED_AT = {x: 80, y: 26};
const LED_BODY = 'radial-gradient(circle at 40% 36%, #fff3a6, #f2c200 58%, #a87f00)';
const LedParts = () => (
    <React.Fragment>
        <Resistor x={50} y={13} />
        <Flat
            x={LED_AT.x - 22}
            y={LED_AT.y - 22}
            w={44}
            h={44}
            z={PCB_H + 0.2}
            style={{
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,214,40,0.55) 0%, rgba(255,214,40,0.18) 40%, rgba(255,214,40,0) 70%)'
            }}
        />
        <Stack
            cx={LED_AT.x}
            cy={LED_AT.y}
            layers={[
                [15, PCB_H + 0.4, '#d9b100'],
                [15, PCB_H + 1.2, '#e8c000'],
                ...[2, 3, 4, 5, 6, 7, 8].map(i => [13, PCB_H + i, LED_BODY]),
                [12, PCB_H + 9, LED_BODY],
                [10.5, PCB_H + 10, LED_BODY],
                [8, PCB_H + 10.8, LED_BODY],
                [4.5, PCB_H + 11.4, 'radial-gradient(circle at 40% 36%, #ffffff, #fff1a0 70%)']
            ]}
        />
    </React.Fragment>
);

const BTN_AT = {x: 66, y: 24};
const ButtonParts = () => (
    <React.Fragment>
        <Resistor x={38} y={38} />
        <Box
            x={BTN_AT.x - 12}
            y={BTN_AT.y - 12}
            w={24}
            d={24}
            h={6}
            z={PCB_H}
            faces={{
                t: {
                    bg: 'linear-gradient(135deg, #e3e4e5, #9fa1a3)',
                    content: (
                        <FaceSvg w={24} h={24}>
                            {[[3, 3], [21, 3], [3, 21], [21, 21]].map(([px, py]) => (
                                <circle key={`${px}-${py}`} cx={px} cy={py} r={1.3} fill="#6d6f71" />
                            ))}
                        </FaceSvg>
                    )
                },
                ...sides('linear-gradient(#2a2a2a, #111)', '#1c1c1c')
            }}
        />
        <Stack
            cx={BTN_AT.x}
            cy={BTN_AT.y}
            layers={[
                ...[6.4, 7.2, 8, 8.8, 9.6].map(z => [15, PCB_H + z, '#9e1c1c']),
                [15, PCB_H + 10.4, 'radial-gradient(circle at 38% 34%, #ff7a7a, #d32f2f 55%, #8e1515)']
            ]}
        />
    </React.Fragment>
);

const DHT_BODY = {x: 50, y: 8, w: 52, d: 40, h: 13};
const DhtParts = () => (
    <React.Fragment>
        <Resistor x={36} y={4} />
        <Box
            x={DHT_BODY.x}
            y={DHT_BODY.y}
            w={DHT_BODY.w}
            d={DHT_BODY.d}
            h={DHT_BODY.h}
            z={PCB_H}
            faces={{
                t: {
                    bg: 'linear-gradient(135deg, #5aa2ea, #3b7fcf)',
                    radius: 'calc(1.5 * var(--u))',
                    content: (
                        <FaceSvg w={DHT_BODY.w} h={DHT_BODY.d}>
                            {[0, 1, 2, 3, 4].map(row => [0, 1, 2, 3, 4, 5].map(col => (
                                <rect
                                    key={`${row}-${col}`}
                                    x={5 + (col * 7.4)}
                                    y={5 + (row * 6.4)}
                                    width={4.4}
                                    height={3.6}
                                    rx={0.6}
                                    fill="#1d4f8f"
                                />
                            )))}
                        </FaceSvg>
                    )
                },
                ...sides('linear-gradient(#4a90dc, #2f6cb5)', '#2f6cb5', '#285e9e')
            }}
        />
    </React.Fragment>
);

const METAL_WALL = 'radial-gradient(circle, #8f9396 0 66%, #d5d7d9 70%)';
/** Fine wire mesh over a silver disc, sized in board units so it scales with zoom. */
const mesh = (pitch, base) => [
    `radial-gradient(circle, rgba(30,30,30,0.85) 0 32%, transparent 40%) 0 0 / calc(${pitch} * var(--u)) calc(${pitch} * var(--u))`,
    base
].join(', ');

const POT_AT = {x: 65, y: 24};
const PotParts = () => (
    <React.Fragment>
        <Box
            x={POT_AT.x - 13}
            y={POT_AT.y - 12}
            w={26}
            d={24}
            h={7}
            z={PCB_H}
            faces={{
                t: {bg: 'linear-gradient(135deg, #3b7be0, #1f55b0)'},
                ...sides('linear-gradient(#2f6cd0, #1d4f9e)', '#1d4f9e')
            }}
        />
        <Cylinder
            cx={POT_AT.x}
            cy={POT_AT.y}
            size={9}
            z0={PCB_H + 7}
            z1={PCB_H + 10}
            side="#a9acaf"
            top="#c9cbcd"
        />
        <Cylinder
            cx={POT_AT.x}
            cy={POT_AT.y}
            size={18}
            z0={PCB_H + 10}
            z1={PCB_H + 18}
            side="radial-gradient(circle, #111 0 80%, #2b2b2b 84%)"
            top="radial-gradient(circle at 40% 36%, #4a4a4a, #141414 70%)"
        />
        <Flat
            x={POT_AT.x - 0.9}
            y={POT_AT.y - 8}
            w={1.8}
            h={6}
            z={PCB_H + 18.1}
            style={{background: '#f4f4f0', borderRadius: 'calc(1 * var(--u))'}}
        />
    </React.Fragment>
);

const MQ_AT = {x: 82, y: 28};
const GasParts = () => (
    <React.Fragment>
        <Trimmer x={38} y={4} />
        <SmdLed x={38} y={46} color="#ff3b3b" />
        <SmdLed x={46} y={46} color="#3bff6e" />
        <Cylinder
            cx={MQ_AT.x}
            cy={MQ_AT.y}
            size={36}
            z0={PCB_H}
            z1={PCB_H + 3}
            side="#a8601f"
            top="#c7782f"
        />
        <Cylinder
            cx={MQ_AT.x}
            cy={MQ_AT.y}
            size={30}
            z0={PCB_H + 3}
            z1={PCB_H + 15}
            side={METAL_WALL}
            top={mesh(2.4, 'radial-gradient(circle at 40% 36%, #e6e8ea, #8e9194)')}
        />
    </React.Fragment>
);

const MIC_AT = {x: 78, y: 22};
const MicParts = () => (
    <React.Fragment>
        <Trimmer x={38} y={4} />
        <Chip x={40} y={26} w={14} d={10} />
        <SmdLed x={58} y={36} color="#ff3b3b" />
        <Cylinder
            cx={MIC_AT.x}
            cy={MIC_AT.y}
            size={18}
            z0={PCB_H}
            z1={PCB_H + 8}
            side="radial-gradient(circle, #0d0d0d 0 80%, #2a2a2a 86%)"
            top={mesh(1.6, 'radial-gradient(circle, #3a3a3a 0 55%, #1a1a1a 60%)')}
        />
    </React.Fragment>
);

const PulseParts = () => (
    <React.Fragment>
        <Box
            x={48}
            y={18}
            w={14}
            d={12}
            h={2.2}
            z={PCB_H}
            faces={{
                t: {
                    bg: '#0c0c10',
                    content: (
                        <FaceSvg w={14} h={12}>
                            <rect x={2} y={3} width={4.5} height={6} rx={0.8} fill="#2a0d12" stroke="#ff4d6d" strokeWidth={0.5} />
                            <rect x={7.5} y={3} width={4.5} height={6} rx={0.8} fill="#140d22" stroke="#9c7bff" strokeWidth={0.5} />
                        </FaceSvg>
                    )
                },
                ...sides('#16161c', '#101014')
            }}
        />
        <Resistor x={36} y={6} />
        <Resistor x={36} y={38} />
        <Chip x={66} y={34} w={7} d={6} h={1.6} />
    </React.Fragment>
);

const SOIL_PROBE = {x: 62, y: 6, w: 80, d: 28};
const SoilParts = () => (
    <React.Fragment>
        <Chip x={34} y={4} w={12} d={10} />
        <Chip x={34} y={26} w={10} d={8} h={3} />
        <Resistor x={50} y={16} />
    </React.Fragment>
);

const SONAR = [64, 104];
const UltraParts = () => (
    <React.Fragment>
        {SONAR.map(cx => (
            <Cylinder
                key={cx}
                cx={cx}
                cy={26}
                size={32}
                z0={PCB_H}
                z1={PCB_H + 12}
                step={1.2}
                side={METAL_WALL}
                top={mesh(2.2, 'radial-gradient(circle, #4a4c4e 0 60%, #cfd1d3 64%)')}
            />
        ))}
        <Box
            x={80}
            y={2}
            w={8}
            d={4}
            h={3}
            z={PCB_H}
            faces={{t: {bg: 'linear-gradient(#e2e4e6, #9da0a3)', radius: 'calc(2 * var(--u))'}, ...sides('#a9acaf', '#a9acaf')}}
        />
    </React.Fragment>
);

const RfidParts = () => (
    <React.Fragment>
        <Chip x={34} y={34} w={14} d={14} h={1.6} />
        <Box
            x={34}
            y={56}
            w={11}
            d={4}
            h={3}
            z={PCB_H}
            faces={{t: {bg: 'linear-gradient(#e2e4e6, #9da0a3)', radius: 'calc(2 * var(--u))'}, ...sides('#a9acaf', '#a9acaf')}}
        />
        <Resistor x={34} y={20} />
    </React.Fragment>
);

const heartPath = (x, y, s) => `M${x},${y + (s * 0.3)} C${x},${y - (s * 0.2)} ${x - s},${y - (s * 0.2)} ${x - s},${y + (s * 0.3)}
    C${x - s},${y + (s * 0.7)} ${x},${y + s} ${x},${y + (s * 1.1)} C${x},${y + s} ${x + s},${y + (s * 0.7)} ${x + s},${y + (s * 0.3)}
    C${x + s},${y - (s * 0.2)} ${x},${y - (s * 0.2)} ${x},${y + (s * 0.3)} Z`;

const GREEN = {pcb: '#36673b', edge: '#24452a'};
const NAVY = {pcb: '#1d2f4f', edge: '#121d31'};
const BLUE = {pcb: '#1f5fa8', edge: '#123d70'};

const MODULE_3D = {
    led: {w: 104, h: 48, jackY: 24, ...GREEN, label: 'LED', labelAt: [80, 8], Parts: LedParts},
    btn: {w: 96, h: 48, jackY: 24, ...GREEN, label: 'BUTTON', labelAt: [66, 44], Parts: ButtonParts},
    dht: {w: 112, h: 56, jackY: 28, ...NAVY, label: 'DHT11', labelAt: [76, 53], Parts: DhtParts},
    pot: {w: 96, h: 48, jackY: 24, ...BLUE, label: 'POT', labelAt: [65, 43], Parts: PotParts},
    mq2: {w: 110, h: 56, jackY: 28, ...NAVY, label: 'MQ-2', labelAt: [45, 28], Parts: GasParts},
    mic: {w: 96, h: 44, jackY: 22, pcb: '#9e1f1f', edge: '#6a1414', label: 'MIC', labelAt: [78, 39], Parts: MicParts},
    pulse: {
        w: 84,
        h: 48,
        jackY: 24,
        pcb: '#4a2178',
        edge: '#2f1350',
        label: 'HW-605',
        labelAt: [56, 42],
        Silk: () => <path d={heartPath(55, 6, 4)} fill="#ff6b8a" />,
        Parts: PulseParts
    },
    soil: {
        w: 150,
        h: 40,
        jackY: 20,
        pcb: '#151515',
        edge: '#0b0b0b',
        label: 'Capacitive Soil Moisture Sensor v1.2',
        labelAt: [102, 37],
        labelSize: 3.4,
        Silk: () => (
            <g>
                <rect
                    x={SOIL_PROBE.x}
                    y={SOIL_PROBE.y}
                    width={SOIL_PROBE.w}
                    height={SOIL_PROBE.d}
                    rx={2}
                    fill="#1e1e1e"
                    stroke="#2e2e2e"
                    strokeWidth={0.6}
                />
                <line x1={58} y1={2} x2={58} y2={38} stroke="#f4f4f0" strokeWidth={0.8} strokeDasharray="2 1.4" />
            </g>
        ),
        Parts: SoilParts
    },
    ultra: {w: 124, h: 52, jackY: 26, ...BLUE, label: 'HC-SR04', labelAt: [84, 48], Parts: UltraParts},
    rfid: {
        w: 120,
        h: 84,
        jackY: 42,
        ...BLUE,
        label: 'RFID-RC522',
        labelAt: [83, 42],
        labelSize: 4.4,
        Silk: () => (
            <g fill="none" stroke="#5c9be6" strokeWidth={1.4}>
                {[0, 1, 2, 3].map(i => (
                    <rect
                        key={i}
                        x={58 + (i * 4)}
                        y={10 + (i * 4)}
                        width={50 - (i * 8)}
                        height={64 - (i * 8)}
                        rx={4}
                    />
                ))}
            </g>
        ),
        Parts: RfidParts
    }
};

const hasModule3D = moduleId => Boolean(MODULE_3D[moduleId]);

const PcbTop = ({spec}) => (
    <FaceSvg w={spec.w} h={spec.h}>
        {spec.Silk ? <spec.Silk /> : null}
        {[[spec.w - 6, 6], [spec.w - 6, spec.h - 6]].map(([hx, hy]) => (
            <g key={`${hx}-${hy}`}>
                <circle cx={hx} cy={hy} r={3.2} fill="#c9b27a" />
                <circle cx={hx} cy={hy} r={1.8} fill="#141414" />
            </g>
        ))}
        <text
            x={spec.labelAt[0]}
            y={spec.labelAt[1]}
            fill="#f4f4f0"
            fontFamily={SILK_FONT}
            fontWeight={700}
            fontSize={spec.labelSize || 5.5}
            letterSpacing={0.4}
            textAnchor="middle"
            dominantBaseline="middle"
        >
            {spec.label}
        </text>
    </FaceSvg>
);

/** One plugged-in module, centred and turned by its placement so the socket faces the board. */
const Module3D = ({moduleId, placement, name, floorZ}) => {
    const spec = MODULE_3D[moduleId];
    if (!spec) {
        return null;
    }
    const {Parts} = spec;
    return (
        <div
            className="tb3d-group"
            style={{'--gx': placement.cx, '--gy': placement.cy, 'transform': `rotateZ(${placement.rotation}deg)`}}
            title={name}
        >
            <div
                className="tb3d-group"
                style={{'--gx': -spec.w / 2, '--gy': -spec.h / 2}}
            >
                <Flat
                    x={2}
                    y={4}
                    w={spec.w}
                    h={spec.h}
                    z={floorZ}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 'calc(4 * var(--u))',
                        filter: 'blur(calc(5 * var(--u)))'
                    }}
                />
                <Box
                    x={0}
                    y={0}
                    w={spec.w}
                    d={spec.h}
                    h={PCB_H}
                    faces={{
                        t: {bg: spec.pcb, radius: 'calc(2 * var(--u))', content: <PcbTop spec={spec} />},
                        ...sides(spec.edge, spec.edge)
                    }}
                />
                <JackBox
                    x={-2}
                    y={spec.jackY - (JACK.h / 2)}
                    w={JACK.w}
                    d={JACK.h}
                    z={PCB_H}
                    open="W"
                    color="#8d9093"
                />
                <Parts />
            </div>
        </div>
    );
};

export {MODULE_3D, PCB_H, PcbTop, hasModule3D, heartPath};
export default Module3D;
