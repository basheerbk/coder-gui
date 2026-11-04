import {TOP, axial} from '../lib/parts.js';
import {screwTerminal, smd, text} from '../lib/breakout.js';

/*
 * TinkerBit MOSFET adapter: purple RJ11 carrier with a logic-level MOSFET (TO-220), gate resistor,
 * flyback diode, status LED, a DC jack for the load's supply and a 2-pole OUT screw terminal.
 * Shared by the water pump and the solenoid lock.
 */
const W = 92;
const H = 64;
const CY = H / 2;
const TERM_X = W - 22;

const TAB = '<rect width="24" height="16" fill="#c9ccce"/><circle cx="12" cy="8" r="3.4" fill="#2a2c2f"/>';
const BODY = '<rect width="24" height="22" fill="#141416"/>' +
    '<text x="12" y="10" fill="#7d8086" font-family="Arial, sans-serif" font-size="3" text-anchor="middle">IRLZ44N</text>';

const adapterSpec = label => ({
    w: W,
    h: H,
    jackY: CY,
    label,
    labelAt: [52, H - 4],
    labelSize: 3.4,
    holes: [[6, 6], [6, H - 6]],
    silk: `<path d="M 26 ${CY} H 34 L 40 ${CY + 6} H 44" stroke="#6531a3" stroke-width="1.2" fill="none"/>` +
        `<path d="M 60 ${CY + 10} H ${TERM_X}" stroke="#6531a3" stroke-width="2.4" fill="none"/>` +
        text('OUT', TERM_X + 9, 3.8, {size: 2.4}) + text('12V IN', 49, 4.2, {size: 2.2}) +
        text('+', TERM_X - 3, CY - 6, {size: 2.8}) + text('-', TERM_X - 3, CY + 6, {size: 2.8})
});

/** The adapter's parts; returns the world point (x, y, z) where the OUT terminal's wires start. */
const buildAdapter = (kit, g) => {
    smd(kit, g, 36, CY + 8);
    smd(kit, g, 36, CY - 12);
    g.add(kit.box({x: 36, y: CY - 6, w: 4.4, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color: '#30ff60'})}}));
    // TO-220 standing: legs, body, metal tab
    [-6.1, 0, 6.1].forEach(o => g.add(kit.box({x: 52 + o - 0.7, y: CY + 12, w: 1.4, d: 1.4, h: 6, z: TOP, color: {color: '#cfd2d5', metal: 0.8, rough: 0.3}, shadow: false})));
    g.add(kit.box({x: 40, y: CY + 8, w: 24, d: 11, h: 22, z: TOP + 6, color: {color: '#141416', rough: 0.4}}));
    g.add(kit.sideDecal({face: 's', x: 40, y: CY + 8, w: 24, d: 11, z: TOP + 6, h: 22, material: {map: kit.tex.svg('to220-body', 24, 22, BODY, {ppu: 10, base: '#141416'}), rough: 0.4}}));
    g.add(kit.box({x: 40, y: CY + 7, w: 24, d: 3, h: 38, z: TOP + 6, color: {color: '#c9ccce', rough: 0.3, metal: 0.85}}));
    g.add(kit.sideDecal({face: 'n', x: 40, y: CY + 7, w: 24, d: 3, z: TOP + 28, h: 16, material: {map: kit.tex.svg('to220-tab', 24, 16, TAB, {ppu: 10, base: '#c9ccce'}), rough: 0.3, metal: 0.8}}));
    // 1N5819 flyback diode lying flat, DC jack at the north edge
    g.add(axial(kit, {x0: 52, x1: 64, cy: CY - 10, cz: TOP + 2.6, r: 2.6, seg: 20, side: {color: '#151515', rough: 0.4}}));
    g.add(axial(kit, {x0: 61, x1: 63, cy: CY - 10, cz: TOP + 2.6, r: 2.65, seg: 20, side: {color: '#cfd2d5', rough: 0.4}}));
    g.add(kit.box({x: 40, y: 0, w: 22, d: 34, h: 26, z: TOP, color: {color: '#151517', rough: 0.45}}));
    g.add(axial(kit, {x0: 40.5, x1: 41, cy: 13, cz: TOP + 13, r: 7, side: {color: '#0b0b0c'}, bottom: {color: '#050505'}}));
    screwTerminal(kit, g, {x: TERM_X, y: CY - 12, n: 2, pitch: 12, open: 'e'});
    return {x: TERM_X + 18, y: CY, z: TOP + 13};
};

export {W as ADAPTER_W, H as ADAPTER_H, adapterSpec, buildAdapter};
