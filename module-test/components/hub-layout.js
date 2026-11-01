/*
 * RJ11 Hub layout: jack footprints, copper traces and parts positions, with no three.js
 * imports so the studio's 2D view can use it too. Hub units are SVG-style (y down) on a
 * HUB.w × HUB.h board; multiply by HUB_SCALE for world units.
 */
const HUB = {w: 560, h: 750};
const S = 0.375;
const JACK_ACROSS = 0.8;
const JACK_DEPTH = 0.86;

/** open: the board edge the plug enters from; x, y, w, d: the jack's footprint box (hub units). */
const PORT_DEFS = [
    {id: 'A4', open: 'W', x: -32, y: -40, w: 182, d: 120, desc: 'Analog port'},
    {id: 'I2C', open: 'N', x: 153, y: -70, w: 122, d: 180, desc: 'I²C bus port'},
    {id: 'I2C1', open: 'N', x: 277, y: -70, w: 122, d: 180, desc: 'Second I²C bus port'},
    {id: 'TOP-R', open: 'E', x: 403, y: -40, w: 182, d: 120, desc: 'Port'},
    {id: 'N01', open: 'W', x: -32, y: 88, w: 182, d: 122, desc: 'RJ11 port'},
    {id: 'STEPPER1', open: 'W', x: -32, y: 223, w: 182, d: 124, desc: 'Stepper motor port'},
    {id: 'A1', open: 'W', x: -32, y: 368, w: 182, d: 124, desc: 'Analog port'},
    {id: 'D13', open: 'W', x: -32, y: 520, w: 182, d: 124, desc: 'Digital port'},
    {id: 'A3', open: 'E', x: 403, y: 76, w: 182, d: 124, desc: 'Analog port'},
    {id: 'A2', open: 'E', x: 403, y: 223, w: 182, d: 124, desc: 'Analog port'},
    {id: 'UART1', open: 'E', x: 403, y: 360, w: 182, d: 122, desc: 'Serial (UART) port'},
    {id: 'J0', open: 'E', x: 403, y: 518, w: 182, d: 124, desc: 'RJ11 port'},
    {id: 'RJ11', open: 'S', x: 222, y: 622, w: 126, d: 178, desc: 'Bottom RJ11 port, wired to U4'}
];

/** Signal traces from each jack (under its housing) to the ESP32 pins. */
const M = x => 550 - x;
const LEFT = {
    'I2C': [[[214, 104], [214, 130], [194, 130], [194, 220], [198, 220]], [[202, 104], [202, 124], [190, 124], [190, 230], [198, 230]]],
    'A4': [[[140, 14], [186, 14], [186, 240], [198, 240]], [[140, 26], [182, 26], [182, 250], [198, 250]]],
    'N01': [[[140, 143], [178, 143], [178, 260], [198, 260]], [[140, 155], [174, 155], [174, 270], [198, 270]]],
    'STEPPER1': [[[140, 280], [198, 280]], [[140, 290], [198, 290]]],
    'A1': [[[140, 424], [182, 424], [182, 310], [198, 310]], [[140, 436], [186, 436], [186, 320], [198, 320]]],
    'D13': [[[140, 576], [190, 576], [190, 330], [198, 330]], [[140, 588], [194, 588], [194, 340], [198, 340]]]
};
const mirror = pts => pts.map(([x, y]) => [M(x), y]);
const shiftStart = (pts, ys) => pts.map(([x, y], i) => (i < 2 ? [x, ys] : [x, y]));
const TRACES = {
    ...LEFT,
    'I2C1': LEFT.I2C.map(mirror),
    'TOP-R': LEFT.A4.map(mirror),
    'A3': LEFT.N01.map((p, i) => shiftStart(mirror(p), i ? 144 : 132)),
    'A2': LEFT.STEPPER1.map(mirror),
    'UART1': LEFT.A1.map((p, i) => shiftStart(mirror(p), i ? 427 : 415)),
    'J0': LEFT.D13.map((p, i) => shiftStart(mirror(p), i ? 586 : 574)),
    'RJ11': [[[279, 632], [279, 538], [262, 521]], [[291, 632], [291, 538], [308, 521]]]
};
const POWER = [[372, 692], [372, 666], [232, 666], [232, 552]];

const PASSIVES = [
    ['C1', 'C', 212, 398, 'v'], ['R1', 'R', 252, 398, 'v'], ['C2', 'C', 292, 398, 'v'], ['R2', 'R', 332, 398, 'v'],
    ['D1', 'D', 272, 440, 'h'],
    ['C3', 'C', 212, 476, 'v']
];
const LEDS = [
    {ref: 'E1', x: 315, y: 560, color: '#ff2828', mode: 'power'},
    {ref: 'D3', x: 330, y: 560, color: '#288cff', mode: 'activity'},
    {ref: 'D4', x: 345, y: 560, color: '#28dc6e', mode: 'heartbeat'}
];
const HOLES = [[168, 370, 7], [530, 498, 7], [20, 664, 8]];

/** The ESP32 module (black PCB under the shield can) and the can's height, hub units. */
const ESP_MODULE = {x: 198, y: 140, w: 154, d: 215, h: 22};

const f1 = n => Math.round(n * 10) / 10;

/** Polyline with chamfered corners as an SVG path. */
const pathD = (pts, c = 6) => {
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const [cx, cy] = pts[i + 1];
        const l1 = Math.hypot(bx - ax, by - ay);
        const l2 = Math.hypot(cx - bx, cy - by);
        const r = Math.min(c, l1 / 2, l2 / 2);
        d += ` L${f1(bx - ((bx - ax) / l1 * r))},${f1(by - ((by - ay) / l1 * r))}` +
            ` L${f1(bx + ((cx - bx) / l2 * r))},${f1(by + ((cy - by) / l2 * r))}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L${f1(last[0])},${f1(last[1])}`;
};

const SIDE = {W: 'left', E: 'right', N: 'top', S: 'bottom'};
const OPEN_ROT = {W: 0, E: Math.PI, N: -Math.PI / 2, S: Math.PI / 2};

const portKind = id => {
    if (/^A\d/.test(id)) {
        return 'analog';
    }
    if (/^I2C/.test(id)) {
        return 'i2c';
    }
    if (/^UART/.test(id)) {
        return 'uart';
    }
    if (/^STEPPER/.test(id)) {
        return 'stepper';
    }
    return 'digital';
};

const STRIPES = {
    analog: {dark: '#10b981', light: '#10b981'},
    i2c: {dark: '#06b6d4', light: '#06b6d4'},
    uart: {dark: '#3b82f6', light: '#3b82f6'},
    stepper: {dark: '#9ca3af', light: '#6b7280'},
    digital: {dark: '#8b5cf6', light: '#8b5cf6'}
};

/** The jack's housing box after shrinking it about its back edge (where the traces enter). */
const jackBox = def => {
    const p = {...def};
    if (p.open === 'W') {
        const back = p.x + p.w;
        p.w *= JACK_DEPTH;
        p.x = back - p.w;
    } else if (p.open === 'E') {
        p.w *= JACK_DEPTH;
    } else if (p.open === 'N') {
        const back = p.y + p.d;
        p.d *= JACK_DEPTH;
        p.y = back - p.d;
    } else {
        p.d *= JACK_DEPTH;
    }
    if (p.open === 'W' || p.open === 'E') {
        const c = p.y + (p.d / 2);
        p.d *= JACK_ACROSS;
        p.y = c - (p.d / 2);
    } else {
        const c = p.x + (p.w / 2);
        p.w *= JACK_ACROSS;
        p.x = c - (p.w / 2);
    }
    return p;
};

/** Jack records in world units relative to the hub's top-left corner; pos.x/y is the mouth. */
const HUB_PORTS = PORT_DEFS.map(def => {
    const b = jackBox(def);
    const side = SIDE[def.open];
    const cx = (b.x + (b.w / 2)) * S;
    const cy = (b.y + (b.d / 2)) * S;
    const mouth = {
        left: [b.x * S, cy],
        right: [(b.x + b.w) * S, cy],
        top: [cx, b.y * S],
        bottom: [cx, (b.y + b.d) * S]
    }[side];
    const kind = portKind(def.id);
    const vertical = side === 'top' || side === 'bottom';
    return {
        id: def.id,
        label: def.id,
        desc: def.desc,
        side,
        kind,
        open: def.open,
        pos: {x: mouth[0], y: mouth[1], cableX: mouth[0], cableY: mouth[1]},
        footprint: {x: b.x * S, y: b.y * S, w: b.w * S, d: b.d * S},
        jack: {D: (vertical ? b.d : b.w) * S, Wd: (vertical ? b.w : b.d) * S},
        colors: STRIPES[kind]
    };
});

/** Each jack's traces in world units (for lighting up the active one). */
const TRACE_POINTS = Object.keys(TRACES).reduce((all, id) => {
    all[id] = TRACES[id].map(line => line.map(([x, y]) => [x * S, y * S]));
    return all;
}, {});

export {
    HUB,
    S as HUB_SCALE,
    PORT_DEFS,
    TRACES,
    POWER,
    PASSIVES,
    LEDS,
    HOLES,
    ESP_MODULE,
    SIDE,
    OPEN_ROT,
    STRIPES,
    pathD,
    portKind,
    jackBox,
    HUB_PORTS,
    TRACE_POINTS
};
