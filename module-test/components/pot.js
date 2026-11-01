import {TOP, axial, ridgeTexture} from '../lib/parts.js';

/*
 * Generic 16 mm rotary potentiometer (B10K) mounted on its side on the RJ11 carrier:
 * shaft horizontal, pointing east away from the socket, with a black knurled knob.
 * About 2.4 units per mm.
 */
const W = 100;
const H = 56;
const CY = H / 2;

const BODY = {x0: 44, x1: 66, r: 19};
const AXIS_Z = TOP + 2.5 + BODY.r;
const NUT = {x0: 66, x1: 70, r: 12};
const BUSH = {x0: 66, x1: 78, r: 8.4};
const SHAFT = {x0: 78, x1: 84, r: 7};
const KNOB = {x0: 82, x1: 100, r: 15};
const CAP = {x0: 100, x1: 102.5, r: 13};
const LUG_Y = [CY - 12, CY, CY + 12];
const LUG_X = 47;

const METAL = {color: '#c3c6c9', rough: 0.3, metal: 0.85};
const SILK = '#f4f4f0';

/** Pads, traces from the socket to the three lugs, and pin names. */
const CARRIER_SILK = LUG_Y.map((y, i) => (
    `<path d="M 26 ${CY + ((y - CY) * 0.4)} L 36 ${CY + ((y - CY) * 0.4)} L 40 ${y} H ${LUG_X}" fill="none" ` +
    'stroke="#6531a3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    `<rect x="${LUG_X - 2.5}" y="${y - 2.5}" width="5" height="5" rx="1" fill="#d4b15e"/>` +
    `<text x="${LUG_X - 6}" y="${y}" fill="${SILK}" font-family="Arial Narrow, sans-serif" font-size="2.8" ` +
    `text-anchor="end" dominant-baseline="middle">${['GND', 'OUT', 'VCC'][i]}</text>`
)).join('');

/** Knob front: matte black with a white pointer line (points up once mapped onto the cap). */
const capSvg = color => `<rect width="26" height="26" fill="${color}"/>` +
    '<circle cx="13" cy="13" r="12.4" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>' +
    '<rect x="12" y="16" width="2" height="8" rx="1" fill="#f4f4f0"/>';

/** Bakelite back wafer with the B10K marking. */
const BACK_SVG = '<rect width="38" height="38" fill="#7a4e26"/>' +
    '<circle cx="19" cy="19" r="11" fill="none" stroke="#5e3a1b" stroke-width="1"/>' +
    '<text x="19" y="21" fill="#e9d8b8" font-family="Arial, sans-serif" font-size="5" font-weight="700" text-anchor="middle">B10K</text>';

/** Rotary potentiometer: metal-shell pot lying on its side with a knurled knob. */
export default {
    id: 'pot',
    name: 'Potentiometer',
    category: 'input',
    defaultPort: 'A1',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'POTENTIOMETER 10K',
        labelAt: [56, 52],
        labelSize: 3.8,
        holes: [[W - 6, 6], [W - 6, H - 6]],
        silk: CARRIER_SILK
    },
    build (kit, g, {options}) {
        const knob = options.knobColor || '#161616';

        // plastic support under the body, then the three solder lugs
        g.add(kit.box({x: BODY.x0 + 2, y: CY - 14, w: BODY.x1 - BODY.x0 - 4, d: 28, h: 2.5, z: TOP, color: {color: '#1d1d1d', rough: 0.6}}));
        LUG_Y.forEach(y => g.add(kit.box({
            x: LUG_X - 0.7,
            y: y - 1.5,
            w: 1.4,
            d: 3,
            h: AXIS_Z - BODY.r + 4 - TOP,
            z: TOP,
            color: {color: '#d9dbdd', rough: 0.3, metal: 0.8},
            shadow: false
        })));

        // body: brown bakelite back, metal shell, front ring
        g.add(axial(kit, {
            x0: BODY.x0,
            x1: BODY.x0 + 4,
            cy: CY,
            cz: AXIS_Z,
            r: BODY.r - 0.4,
            side: {color: '#6e4522', rough: 0.7},
            bottom: {map: kit.tex.svg('pot-back', 38, 38, BACK_SVG, {ppu: 10, base: '#7a4e26'}), rough: 0.7}
        }));
        g.add(axial(kit, {
            x0: BODY.x0 + 4,
            x1: BODY.x1,
            cy: CY,
            cz: AXIS_Z,
            r: BODY.r,
            seg: 48,
            side: METAL,
            top: {color: '#aeb2b6', rough: 0.35, metal: 0.85}
        }));

        // threaded bushing, hex nut and the bare shaft
        g.add(axial(kit, {
            x0: BUSH.x0,
            x1: BUSH.x1,
            cy: CY,
            cz: AXIS_Z,
            r: BUSH.r,
            seg: 32,
            side: {map: ridgeTexture(kit, 'thread', Math.PI * 2 * BUSH.r, BUSH.x1 - BUSH.x0, 1.6, '#c9ccce', '#8c9094'), rough: 0.35, metal: 0.85},
            top: METAL
        }));
        g.add(axial(kit, {x0: NUT.x0, x1: NUT.x1, cy: CY, cz: AXIS_Z, r: NUT.r, seg: 6, side: METAL, top: METAL, bottom: METAL}));
        g.add(axial(kit, {x0: SHAFT.x0, x1: SHAFT.x1, cy: CY, cz: AXIS_Z, r: SHAFT.r, seg: 28, side: {color: '#d4d6d8', rough: 0.25, metal: 0.9}}));

        // knurled knob with a slightly smaller front cap carrying the pointer
        g.add(axial(kit, {
            x0: KNOB.x0,
            x1: KNOB.x1,
            cy: CY,
            cz: AXIS_Z,
            r: KNOB.r,
            seg: 48,
            side: {map: ridgeTexture(kit, `knurl:${knob}`, Math.PI * 2 * KNOB.r, KNOB.x1 - KNOB.x0, 2.2, knob, '#050505'), rough: 0.6},
            top: {color: knob, rough: 0.55},
            bottom: {color: knob, rough: 0.55}
        }));
        g.add(axial(kit, {
            x0: CAP.x0 - 0.5,
            x1: CAP.x1,
            cy: CY,
            cz: AXIS_Z,
            r: CAP.r,
            seg: 48,
            side: {color: options.knobTop || '#222222', rough: 0.45},
            top: {map: kit.tex.svg(`pot-cap:${options.knobTop || '#222222'}`, 26, 26, capSvg(options.knobTop || '#222222'), {ppu: 10, base: '#222222'}), rough: 0.45}
        }));
    }
};
