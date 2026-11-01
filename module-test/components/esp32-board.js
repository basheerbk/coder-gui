import {Group} from 'three';

import {CARD, SLAB_T, STUB} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {PCB_COLOR, PCB_EDGE} from '../lib/pcb.js';
import {BLACK, buildJack, chipTopSvg, glowDecal, ownCopy, passiveTexture} from '../lib/parts.js';
import {
    ESP_MODULE,
    HOLES,
    HUB,
    HUB_PORTS,
    HUB_SCALE as S,
    LEDS,
    OPEN_ROT,
    PASSIVES,
    POWER,
    TRACES,
    TRACE_POINTS,
    pathD
} from './hub-layout.js';

/*
 * RJ11 Hub: ESP32 maker board with 13 RJ11 jacks and USB-C, on the purple house PCB.
 * Layout (hub-layout.js) is drawn in hub units (HUB.w × HUB.h, SVG-style y down) and scaled
 * by S into world units so the jacks match the module sockets.
 */
const T = SLAB_T / S;

const SILK = '#f4f4f0';
const TRACE = '#6531a3';
const TRACE_HI = '#8455c4';
const GOLD_PAD = 'url(#hPad)';
const LEG = '#c9ccce';
const SILK_FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';

// ---- Artwork ----------------------------------------------------------------

/** Silkscreen jack names: [hub jack id, x, y, rotation]. */
const JACK_SILK = [
    ['A4', 157, 58, 90], ['N01', 157, 104, 90], ['STEPPER1', 157, 246, 90], ['A1', 157, 382, 90], ['D13', 157, 537, 90],
    ['A3', 396, 186, -90], ['A2', 396, 333, -90], ['UART1', 396, 458, -90], ['J0', 396, 628, -90],
    ['I2C', 238, 124, 180], ['I2C1', 312, 124, 180], ['RJ11', 285, 613, 0]
];

const silk = (t, x, y, size = 9, rot = 0, anchor = 'middle') => (
    `<text x="${x}" y="${y}" font-family='${SILK_FONT}' font-weight="600" font-size="${size}" fill="${SILK}" ` +
    `text-anchor="${anchor}" dominant-baseline="middle"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`
);

const DEFS = '<defs>' +
    '<linearGradient id="hPad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc93"/><stop offset="1" stop-color="#b88f37"/></linearGradient>' +
    '<radialGradient id="hDrill" cx=".6" cy=".6" r=".6"><stop offset="0" stop-color="#121212"/><stop offset="1" stop-color="#2e2e2c"/></radialGradient>' +
    '</defs>';

/**
 * The board's top: purple mask, raised copper traces, gold pads, white silkscreen.
 * labels: hub jack id → the name to print beside that jack (defaults to the id).
 */
const boardTopSvg = (labels = {}) => {
    let s = `${DEFS}<rect width="${HUB.w}" height="${HUB.h}" fill="${PCB_COLOR}"/>`;
    const all = Object.keys(TRACES).reduce((list, k) => list.concat(TRACES[k]), []);
    const stubs = [230, 250, 270, 290, 310].map(x => [[x, 355], [x, 378]]);
    const shorts = [[[212, 407], [212, 467]], [[332, 407], [332, 440], [282, 440]], [[262, 440], [252, 440], [252, 407]]];
    const group = (list, w) => list.map(p => (
        `<path d="${pathD(p)}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
    )).join('');
    const relief = (list, w) => `<g stroke="rgba(0,0,0,.22)" transform="translate(.7 .9)">${group(list, w + 0.6)}</g>` +
        `<g stroke="${TRACE}">${group(list, w)}</g>` +
        `<g stroke="${TRACE_HI}" transform="translate(-.5 -.6)" opacity=".7">${group(list, w * 0.3)}</g>`;
    s += relief([...all, ...stubs, ...shorts], 3);
    s += relief([POWER], 6);
    stubs.forEach(([[x]]) => {
        s += `<circle cx="${x}" cy="380" r="3.4" fill="${GOLD_PAD}"/><circle cx="${x}" cy="380" r="1.4" fill="#1a1a1a"/>`;
    });
    // ESP32 castellation pads
    for (let i = 0; i < 13; i++) {
        const y = 220 + (i * 10);
        s += `<rect x="192" y="${y - 2}" width="8" height="4" fill="${GOLD_PAD}"/><rect x="350" y="${y - 2}" width="8" height="4" fill="${GOLD_PAD}"/>`;
    }
    for (let i = 0; i < 12; i++) {
        s += `<rect x="${220 + (i * 10) - 2}" y="353" width="4" height="7" fill="${GOLD_PAD}"/>`;
    }
    // passive and LED pads
    PASSIVES.forEach(([, , x, y, o]) => {
        s += o === 'v' ?
            `<rect x="${x - 4.5}" y="${y - 9}" width="9" height="5" fill="${GOLD_PAD}"/><rect x="${x - 4.5}" y="${y + 4}" width="9" height="5" fill="${GOLD_PAD}"/>` :
            `<rect x="${x - 10}" y="${y - 4.5}" width="5" height="9" fill="${GOLD_PAD}"/><rect x="${x + 5}" y="${y - 4.5}" width="5" height="9" fill="${GOLD_PAD}"/>`;
    });
    LEDS.forEach(l => {
        s += `<rect x="${l.x - 4}" y="${l.y - 8}" width="8" height="4" fill="${GOLD_PAD}"/><rect x="${l.x - 4}" y="${l.y + 4}" width="8" height="4" fill="${GOLD_PAD}"/>`;
    });
    // U4 SOIC legs, U1 SOT-223 legs and tab, SOT-23 legs
    for (let i = 0; i < 8; i++) {
        const y = 474 + (i * 6.6);
        s += `<rect x="260" y="${y - 1.6}" width="9" height="3.2" fill="${LEG}"/><rect x="301" y="${y - 1.6}" width="9" height="3.2" fill="${LEG}"/>`;
    }
    [212, 223, 234].forEach(x => {
        s += `<rect x="${x - 2.5}" y="512" width="5" height="12" fill="${LEG}"/>`;
    });
    s += `<rect x="217" y="548" width="12" height="7" fill="${LEG}"/>`;
    [471, 481].forEach(y => {
        s += `<rect x="333" y="${y - 1.5}" width="5" height="3" fill="${LEG}"/>`;
    });
    s += `<rect x="345" y="474.5" width="5" height="3" fill="${LEG}"/>`;
    // fuse and ZGA diode pads
    s += `<rect x="203" y="576" width="5" height="8" fill="${GOLD_PAD}"/><rect x="216" y="576" width="5" height="8" fill="${GOLD_PAD}"/>`;
    s += `<rect x="238" y="577" width="6" height="10" fill="${GOLD_PAD}"/><rect x="260" y="577" width="6" height="10" fill="${GOLD_PAD}"/>`;
    // mounting holes: gold ring, dark drill
    HOLES.forEach(([x, y, r]) => {
        s += `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="${GOLD_PAD}"/><circle cx="${x}" cy="${y}" r="${r - 1}" fill="url(#hDrill)"/>`;
    });
    // 5V / GND / 3.3V header pads
    [['5V', 676], ['GND', 700], ['3.3V', 724]].forEach(([t, y]) => {
        s += `<rect x="468" y="${y - 9}" width="84" height="18" fill="none" stroke="${SILK}" stroke-width="1"/>`;
        for (let i = 0; i < 5; i++) {
            const x = 477 + (i * 16);
            s += `<circle cx="${x}" cy="${y}" r="6" fill="${GOLD_PAD}"/><circle cx="${x}" cy="${y}" r="2.6" fill="url(#hDrill)"/>`;
        }
        s += silk(t, 462, y, 11, 0, 'end');
    });
    // port labels
    JACK_SILK.forEach(([id, x, y, rot]) => {
        s += silk(labels[id] || id, x, y, 10, rot);
    });
    // reference designators
    PASSIVES.forEach(([ref, , x, y, o]) => {
        s += o === 'v' ? silk(ref, x - 8, y, 7, -90) : silk(ref, x, y - 10, 7);
    });
    s += silk('U4', 252, 497, 9, -90) + silk('U1', 250, 536, 9) + silk('U1', 341, 463, 7) + silk('ZGA', 252, 569, 8) +
        silk('PWR_LED1', 330, 579, 8);
    LEDS.forEach(l => {
        s += silk(l.ref, l.x, 547, 6.5);
    });
    s += silk('RST', 33, 728, 11) + silk('BOOT', 120, 724, 11) + silk('LMS', 190, 656, 11) + silk('USB1', 380, 674, 10);
    s += `<circle cx="190" cy="398" r="1.6" fill="${SILK}"/><circle cx="264" cy="466" r="1.6" fill="${SILK}"/>`;
    return s;
};

const MODULE_TOP = (() => {
    let s = '<rect width="154" height="215" fill="#141414"/>' +
        '<path d="M14,12 H140 M14,12 V60 M28,12 V52 H40 V20 H52 V52 H64 V20 H76 V52 H88 V20 H100 V52 H112 V20 H124 V52" ' +
        'fill="none" stroke="#242424" stroke-width="3.2"/>' +
        '<rect width="154" height="215" fill="none" stroke="#2a2a2a" stroke-width="1.5"/>';
    for (let i = 0; i < 13; i++) {
        const y = 80 + (i * 10);
        s += `<path d="M0,${y - 3} A3,3 0 0 1 0,${y + 3} Z" fill="#c9a34c"/><path d="M154,${y - 3} A3,3 0 0 0 154,${y + 3} Z" fill="#c9a34c"/>`;
    }
    for (let i = 0; i < 12; i++) {
        const x = 22 + (i * 10);
        s += `<path d="M${x - 3},215 A3,3 0 0 1 ${x + 3},215 Z" fill="#c9a34c"/>`;
    }
    return s;
})();

const CAN_TOP = '<defs><linearGradient id="hCan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ddd9cf"/>' +
    '<stop offset=".55" stop-color="#b9b4a8"/><stop offset="1" stop-color="#d0ccc2"/></linearGradient></defs>' +
    '<rect width="146" height="138" rx="2" fill="url(#hCan)"/>' +
    '<rect x="1" y="1" width="144" height="136" rx="2" fill="none" stroke="rgba(0,0,0,.18)"/>' +
    '<text x="18" y="38" font-family=\'"Chakra Petch", "Arial Narrow", sans-serif\' font-weight="700" font-size="23" fill="#3a3832">ESP-32</text>' +
    '<text x="18" y="66" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="17" fill="#3a3832">CE</text>' +
    '<circle cx="30" cy="84" r="5" fill="none" stroke="#3a3832" stroke-width="1.2"/>' +
    '<text x="42" y="88" font-family="monospace" font-size="9.5" fill="#3a3832">111S3-3100</text>' +
    '<text x="18" y="106" font-family="monospace" font-size="9.5" fill="#3a3832">PRC::DB60K1B408</text>' +
    '<circle cx="12" cy="126" r="3" fill="#1a1a1a"/>';

const USB_TOP = '<defs><linearGradient id="hUsb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6e7e8"/>' +
    '<stop offset=".5" stop-color="#a9acaf"/><stop offset="1" stop-color="#d4d6d8"/></linearGradient></defs>' +
    '<rect width="56" height="68" rx="3" fill="url(#hUsb)"/>' +
    '<line x1="4" y1="20" x2="52" y2="20" stroke="rgba(0,0,0,.25)"/>' +
    '<ellipse cx="18" cy="44" rx="4" ry="6" fill="rgba(0,0,0,.12)"/><ellipse cx="38" cy="44" rx="4" ry="6" fill="rgba(0,0,0,.12)"/>';

const USB_FRONT = '<rect width="56" height="26" fill="#c9cbcd"/>' +
    '<rect x="6" y="5" width="44" height="16" rx="8" fill="#141516" stroke="#8d9093" stroke-width="1.4"/>' +
    '<rect x="15" y="11" width="26" height="4" rx="1" fill="#2e3033"/>' +
    [0, 1, 2, 3, 4, 5].map(i => `<rect x="${17 + (i * 4)}" y="11.4" width="2" height="3.2" fill="#d6b25a"/>`).join('');

/** Gold half-holes along one edge of the ESP32 module, as a len × 8 strip. */
const castStrip = (len, positions) => `<rect width="${len}" height="8" fill="#151515"/>` +
    positions.map(p => `<rect x="${p - 2.5}" y="0" width="5" height="8" fill="#c9a34c"/>`).join('');

// ---- Ports ------------------------------------------------------------------

/** Port records in world units, shaped like the studio's (side, kind, pos.cableX/Y, pos.cardX/Y). */
const PORTS = HUB_PORTS.map(port => {
    const [mx, my] = [port.pos.x, port.pos.y];
    const card = {
        left: [mx - STUB - CARD.w, my - (CARD.h / 2)],
        right: [mx + STUB, my - (CARD.h / 2)],
        top: [mx - (CARD.w / 2), my - STUB - CARD.h],
        bottom: [mx - (CARD.w / 2), my + STUB]
    }[port.side];
    return {...port, pos: {...port.pos, cardX: card[0], cardY: card[1]}};
});

// ---- Build ------------------------------------------------------------------

/**
 * The PCB and everything soldered to it, built in hub units inside a group scaled by S.
 * labels: silkscreen names for the jacks (see boardTopSvg).
 */
const buildBoard = (kit, {labels = null} = {}) => {
    const group = new Group();
    group.scale.setScalar(S);
    const topKey = labels ? `hub-top:${Object.keys(labels).map(k => `${k}=${labels[k]}`).join(',')}` : 'hub-top';

    group.add(kit.slab({
        x: 0,
        y: 0,
        w: HUB.w,
        d: HUB.h,
        h: T,
        z: -T,
        r: 8,
        top: {map: kit.tex.svg(topKey, HUB.w, HUB.h, boardTopSvg(labels || {}), {ppu: 4, base: PCB_COLOR}), rough: 0.6},
        side: {color: PCB_EDGE, rough: 0.7}
    }));

    // ESP32 module: black PCB with castellations, then the shield can
    const mod = {x: ESP_MODULE.x, y: ESP_MODULE.y, w: ESP_MODULE.w, d: ESP_MODULE.d, h: 8, z: 0};
    group.add(kit.box({
        ...mod,
        color: {color: '#151515', rough: 0.5},
        faces: {t: {map: kit.tex.svg('hub-esp-top', 154, 215, MODULE_TOP, {ppu: 5, base: '#141414'}), rough: 0.5}}
    }));
    const side13 = Array.from({length: 13}, (_, i) => 80 + (i * 10));
    const bottom12 = Array.from({length: 12}, (_, i) => 22 + (i * 10));
    const castMat = (key, len, pos) => ({map: kit.tex.svg(`hub-cast-${key}`, len, 8, castStrip(len, pos), {ppu: 6, base: '#151515'}), rough: 0.4});
    group.add(kit.sideDecal({...mod, face: 's', material: castMat('s', 154, bottom12)}));
    group.add(kit.sideDecal({...mod, face: 'w', material: castMat('w', 215, side13)}));
    group.add(kit.sideDecal({...mod, face: 'e', material: castMat('e', 215, side13.map(p => 215 - p))}));
    group.add(kit.box({
        x: 202,
        y: 213,
        w: 146,
        d: 138,
        h: 14,
        z: 8,
        color: {color: '#bdb8ac', rough: 0.35, metal: 0.75},
        faces: {t: {map: kit.tex.svg('hub-can', 146, 138, CAN_TOP, {ppu: 5, base: '#c9c4b8'}), rough: 0.38, metal: 0.55}}
    }));

    // U4 SOIC, U1 SOT-223, small SOT-23
    const ic = (key, x, y, w, d, h, dot) => group.add(kit.box({
        x,
        y,
        w,
        d,
        h,
        color: BLACK,
        faces: {t: {map: kit.tex.svg(`hub-ic-${key}`, w, d, chipTopSvg(w, d, dot), {ppu: 6, base: '#1a1b1d'}), rough: 0.45}}
    }));
    ic('u4', 267, 469, 36, 57, 9, {x: 7, y: 7});
    ic('u1', 206, 522, 34, 28, 11);
    ic('sot', 337, 470, 9, 13, 6);

    PASSIVES.forEach(([, kind, x, y, o]) => {
        const v = o === 'v';
        const w = v ? 7 : 15;
        const d = v ? 13 : 7;
        group.add(kit.box({
            x: x - (w / 2),
            y: y - (d / 2),
            w,
            d,
            h: kind === 'C' ? 6 : 4.5,
            color: kind === 'C' ? '#8a6641' : '#121212',
            faces: {t: {map: passiveTexture(kit, kind === 'C' ? 'C' : 'R', !v), rough: 0.45}}
        }));
    });

    // fuse and ZGA diode
    group.add(kit.box({
        x: 205,
        y: 576,
        w: 14,
        d: 8,
        h: 5,
        color: '#bdb6aa',
        faces: {t: {map: kit.tex.svg('hub-fuse', 14, 8, '<rect width="14" height="8" fill="#e4ddd2"/>' +
            '<rect width="2.8" height="8" fill="#d2d3d0"/><rect x="11.2" width="2.8" height="8" fill="#d2d3d0"/>' +
            '<rect x="4.9" width="4.2" height="8" fill="#c0392b"/>', {ppu: 8, base: '#e4ddd2'}), rough: 0.5}}
    }));
    group.add(kit.box({
        x: 242,
        y: 577.5,
        w: 20,
        d: 9,
        h: 6,
        color: '#141414',
        faces: {t: {map: kit.tex.svg('hub-zga', 20, 9, '<rect width="20" height="9" fill="#1a1a1a"/>' +
            '<rect x="2.8" width="2" height="9" fill="#9a9a96"/>', {ppu: 8, base: '#1a1a1a'}), rough: 0.5}}
    }));

    // status LEDs with glow
    const leds = LEDS.map(led => {
        group.add(kit.box({x: led.x - 3, y: led.y - 5, w: 6, d: 10, h: 4, color: {color: '#ece9e0', rough: 0.4}}));
        const dot = kit.cylinder({cx: led.x, cy: led.y, r: 2, z0: 4, z1: 4.4, side: kit.basic({color: led.color}), seg: 20});
        dot.castShadow = false;
        group.add(dot);
        const glow = glowDecal(kit, {cx: led.x, cy: led.y, size: 44, z: 4.6, color: led.color, opacity: led.mode === 'power' ? 0.9 : 0.35});
        group.add(glow);
        return {mode: led.mode, glow};
    });

    // RST and BOOT tactile buttons
    [[22, 690], [109, 686]].forEach(([x, y]) => {
        group.add(kit.box({x, y, w: 22, d: 18, h: 9, color: {color: '#a7a9ab', rough: 0.35, metal: 0.6}}));
        group.add(kit.cylinder({
            cx: x + 11,
            cy: y + 9,
            r: 5.5,
            z0: 9,
            z1: 12.5,
            side: {color: '#3d2e27', rough: 0.55},
            top: {color: '#5a463c', rough: 0.5},
            seg: 24
        }));
    });

    // LMS slide switch
    group.add(kit.box({x: 177, y: 668, w: 26, d: 74, h: 12, color: BLACK}));
    group.add(kit.box({x: 184, y: 690, w: 12, d: 20, h: 7, z: 12, color: {color: '#3a3a3a', rough: 0.5}}));

    // USB-C receptacle opening to the south edge
    const usb = {x: 352, y: 684, w: 56, d: 68, h: 26, z: 0};
    group.add(kit.box({
        ...usb,
        color: {color: '#b8babc', rough: 0.3, metal: 0.85},
        faces: {t: {map: kit.tex.svg('hub-usb-top', 56, 68, USB_TOP, {ppu: 6, base: '#c9cbcd'}), rough: 0.3, metal: 0.7}}
    }));
    group.add(kit.sideDecal({
        ...usb,
        face: 's',
        material: {map: kit.tex.svg('hub-usb-front', 56, 26, USB_FRONT, {ppu: 6, base: '#c9cbcd'}), rough: 0.35, metal: 0.5}
    }));

    return {group, leds};
};

/** The 13 RJ11 jacks with their colour stripes, in world units. */
const buildPorts = (kit, theme = 'dark') => PORTS.map(port => {
    const color = port.colors[theme] || port.colors.dark;
    const fp = port.footprint;
    const jack = buildJack(kit, {color, D: port.jack.D, Wd: port.jack.Wd});
    const [cx, cy] = at(fp.x + (fp.w / 2), fp.y + (fp.d / 2));
    jack.position.set(cx, cy, 0);
    jack.rotation.z = OPEN_ROT[port.open];
    jack.traverse(obj => {
        if (obj.isMesh) {
            obj.material = Array.isArray(obj.material) ? obj.material.map(ownCopy) : ownCopy(obj.material);
            obj.userData.portId = port.id;
        }
    });
    return {port, jack, color};
});

/** The RJ11 Hub board with its jacks, in world coordinates. */
const buildBoardScene = (kit, {theme = 'dark'} = {}) => {
    const group = new Group();
    group.name = 'esp32-board';
    const board = buildBoard(kit);
    group.add(board.group);
    const ports = buildPorts(kit, theme);
    ports.forEach(p => group.add(p.jack));
    group.userData.ports = ports;
    group.userData.leds = board.leds;
    return group;
};

export {HUB, S as HUB_SCALE, PORTS, TRACE_POINTS, OPEN_ROT, boardTopSvg, buildBoard, buildPorts, buildBoardScene};

export default {
    id: 'esp32-board',
    name: 'ESP32 RJ11 Hub',
    category: 'board',
    kind: 'board',
    buildScene: buildBoardScene
};
