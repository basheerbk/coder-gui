import {BOARD, PORTS, portPosition} from './ports';

/**
 * Where every part sits on the Maker ESP32 board, in board-local units (0..BOARD.w, 0..BOARD.h).
 * The flat board (BoardArt) and the 3D board (Board3D) both draw from these numbers.
 */

const MOD = {x: 190, y: 82, w: 100, h: 140};
const ANTENNA_H = 40;
const padY = k => MOD.y + 50 + (k * 10);
const PAD_LEFT = MOD.x;
const PAD_RIGHT = MOD.x + MOD.w;
const MODULE_PADS = 9;

/**
 * Copper routes from each jack (s = jack's inner edge) to an ESP32 castellation pad.
 * Lanes are spaced so no two traces cross for the current jack layout.
 */
const ROUTES = {
    'STEPPER': s => [[s.x, s.y], [s.x, 40], [170, 40], [170, padY(2)], [PAD_LEFT, padY(2)]],
    'D13': s => [[s.x, s.y], [s.x, padY(0)], [PAD_LEFT, padY(0)]],
    '3D': s => [[s.x, s.y], [s.x, padY(0)], [PAD_RIGHT, padY(0)]],
    'D5': s => [[s.x, s.y], [s.x, 40], [310, 40], [310, padY(2)], [PAD_RIGHT, padY(2)]],
    'MD': s => [[s.x, s.y], [330, s.y], [330, padY(3)], [PAD_RIGHT, padY(3)]],
    'I2C': s => [[s.x, s.y], [350, s.y], [350, padY(4)], [PAD_RIGHT, padY(4)]],
    'A3': s => [[s.x, s.y], [370, s.y], [370, padY(5)], [PAD_RIGHT, padY(5)]],
    'A2': s => [[s.x, s.y], [350, s.y], [350, padY(6)], [PAD_RIGHT, padY(6)]],
    'A4': s => [[s.x, s.y], [s.x, 245], [310, 245], [310, padY(8)], [PAD_RIGHT, padY(8)]],
    'A1': s => [[s.x, s.y], [s.x, 245], [170, 245], [170, padY(8)], [PAD_LEFT, padY(8)]],
    'ONBOARD': s => [[s.x, s.y], [150, s.y], [150, padY(4)], [PAD_LEFT, padY(4)]],
    'UART': s => [[s.x, s.y], [130, s.y], [130, padY(6)], [PAD_LEFT, padY(6)]]
};

const jackInnerPoint = port => {
    const pos = portPosition(port);
    if (port.side === 'top') {
        return {x: pos.cableX - BOARD.x, y: 5};
    }
    if (port.side === 'bottom') {
        return {x: pos.cableX - BOARD.x, y: BOARD.h - 5};
    }
    if (port.side === 'left') {
        return {x: 5, y: pos.cableY - BOARD.y};
    }
    return {x: BOARD.w - 5, y: pos.cableY - BOARD.y};
};

/**
 * SVG path for a polyline with rounded corners.
 * @param {Array<Array<number>>} pts polyline points
 * @param {number} radius corner radius
 * @returns {string} path data
 */
const roundedPath = (pts, radius = 6) => {
    const f = n => Math.round(n * 10) / 10;
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const [cx, cy] = pts[i + 1];
        const l1 = Math.hypot(bx - ax, by - ay) || 1;
        const l2 = Math.hypot(cx - bx, cy - by) || 1;
        const r = Math.min(radius, l1 / 2, l2 / 2);
        d += ` L${f(bx - ((bx - ax) / l1 * r))},${f(by - ((by - ay) / l1 * r))}`;
        d += ` Q${f(bx)},${f(by)} ${f(bx + ((cx - bx) / l2 * r))},${f(by + ((cy - by) / l2 * r))}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L${f(last[0])},${f(last[1])}`;
};

const TRACES = PORTS
    .filter(port => ROUTES[port.id])
    .map(port => {
        const pts = ROUTES[port.id](jackInnerPoint(port));
        return {
            id: port.id,
            d: roundedPath(pts),
            reverse: roundedPath(pts.slice().reverse())
        };
    });

const HOLES = [[16, 16], [BOARD.w - 16, 16], [16, BOARD.h - 16], [BOARD.w - 16, BOARD.h - 16]];

/** [x, y, kind ('R' | 'C'), horizontal] — centre of each SMD part. */
const PASSIVES = [
    [74, 100, 'C'], [88, 100, 'R'], [102, 100, 'R'], [116, 100, 'C'],
    [74, 122, 'R'], [88, 122, 'C'], [102, 122, 'R'], [116, 122, 'R'],
    [374, 82, 'C'], [388, 82, 'R'], [402, 82, 'R'],
    [374, 100, 'R'], [388, 100, 'C'], [402, 100, 'R'],
    [204, 240, 'R', true], [219, 240, 'C', true], [234, 240, 'R', true]
];

const passiveSize = horizontal => (horizontal ? {w: 11, h: 6} : {w: 6, h: 11});

/** Voltage regulator (SOT-223): body, top tab and three legs. */
const U1 = {
    body: {x: 70, y: 175, w: 28, h: 22},
    tab: {x: 77, y: 170, w: 14, h: 6},
    legs: [76, 84, 92].map(x => ({x: x - 2, y: 196, w: 4, h: 8})),
    label: {x: 84, y: 212}
};

/** 8-pin SOIC chip. */
const U4 = {
    body: {x: 389, y: 190, w: 22, h: 30},
    legs: [0, 1, 2, 3].reduce((all, i) => all.concat([
        {x: 384, y: 196 + (i * 7) - 1.5, w: 6, h: 3},
        {x: 410, y: 196 + (i * 7) - 1.5, w: 6, h: 3}
    ]), []),
    dot: {x: 394, y: 195},
    label: {x: 400, y: 228}
};

/** Status LEDs: power is always on, activity blinks while modules are plugged in, heartbeat pulses. */
const LEDS = [
    {x: 256, y: 240, color: '#ff2828', mode: 'power'},
    {x: 270, y: 240, color: '#288cff', mode: 'activity'},
    {x: 284, y: 240, color: '#28dc6e', mode: 'heartbeat'}
];
const LED_LABEL = {x: 270, y: 252};

const BUTTONS = [
    {x: 100, y: 268, label: 'RST'},
    {x: 138, y: 268, label: 'BOOT'}
];

const HEADER = {
    rows: [['5V', 260], ['GND', 272], ['3.3V', 284]],
    pinXs: [344, 355, 366, 377],
    box: {x: 337, w: 47},
    labelX: 332
};

/** USB-C receptacle; it overhangs the bottom edge like the real part. */
const USB = {x: 215, y: 262, w: 50, h: 44, label: {x: 240, y: 255}};

/** World-space area (board, jacks and default module spots) both build views frame. */
const SCENE = {x: -50, y: -110, w: 940, h: 700};

export {
    SCENE,
    MOD,
    ANTENNA_H,
    MODULE_PADS,
    padY,
    PAD_LEFT,
    PAD_RIGHT,
    ROUTES,
    TRACES,
    roundedPath,
    jackInnerPoint,
    HOLES,
    PASSIVES,
    passiveSize,
    U1,
    U4,
    LEDS,
    LED_LABEL,
    BUTTONS,
    HEADER,
    USB
};
