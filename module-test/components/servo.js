import {CatmullRomCurve3, Mesh, TubeGeometry, Vector3} from 'three';

import {BLACK, TOP} from '../lib/parts.js';

/*
 * SG90 micro servo (about 2.4 units per mm) sitting on the table next to a small purple RJ11
 * carrier. Its brown / red / orange lead runs to a black 3-pin plug pushed onto a right-angle
 * header on the carrier.
 */
const W = 80;
const H = 48;
const CY = H / 2;
const PITCH = 6.1;
const WIRE_COLORS = ['#5a3a22', '#d0302a', '#f28c1c'];
const HEADER = {x: 32, w: 6, h: 6};
const PLUG = {x: 40, len: 34, h: 6};

// SG90: case 22.5 × 12.2 × 22.7 mm, tabs 32.2 mm wide at 16 mm, output shaft 5.9 mm from one end.
const S = {x: 120, w: 54, d: 29.3, h: 54.5};
S.y = CY - (S.d / 2);
const TAB = {z: 38, h: 6, reach: 11.5};
const SHAFT_X = S.x + S.w - 14;
const HORN = {len: 84, hub: 12, tip: 6.4, h: 3.6, z: 66};

const BODY = {color: '#2f6fd6', rough: 0.35, opacity: 0.86};
const WHITE = {color: '#f1f2ee', rough: 0.5};

/** Two-arm horn outline (SVG-style points in a hub × len box, arms along y). */
const HORN_OUTLINE = (() => {
    const cx = HORN.hub / 2;
    const r = HORN.tip / 2;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
        const a = Math.PI + ((Math.PI * i) / 8);
        pts.push([cx + (r * Math.cos(a)), r + (r * Math.sin(a))]);
    }
    pts.push([HORN.hub, HORN.len / 2]);
    for (let i = 0; i <= 8; i++) {
        const a = (Math.PI * i) / 8;
        pts.push([cx + (r * Math.cos(a)), HORN.len - r + (r * Math.sin(a))]);
    }
    pts.push([0, HORN.len / 2]);
    return pts;
})();

const HORN_SVG = `<rect width="${HORN.hub}" height="${HORN.len}" fill="#f1f2ee"/>` +
    [0.13, 0.2, 0.27, 0.34].map(t => [t, 1 - t]).flat()
        .map(t => `<circle cx="${HORN.hub / 2}" cy="${HORN.len * t}" r="0.9" fill="#9a9c98"/>`).join('');

const STICKER_SVG = '<rect width="54" height="54.5" fill="#1d4fa8"/>' +
    '<rect x="3" y="20" width="48" height="22" rx="1.5" fill="#f4f6fa"/>' +
    '<g font-family="Arial, Helvetica, sans-serif" text-anchor="middle" fill="#1d3f86">' +
    '<text x="27" y="31" font-size="8" font-weight="700">SG90</text>' +
    '<text x="27" y="38.5" font-size="4">9g Micro Servo</text></g>';

const CARRIER_SILK = [0, 1, 2].map(i => {
    const y = CY + ((i - 1) * PITCH);
    const jy = CY + ((i - 1) * 2.4);
    return `<path d="M 26 ${jy} H 29 L ${HEADER.x + 2} ${y} H ${HEADER.x + 4}" fill="none" stroke="#6531a3" stroke-width="1.2" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>';
}).join('');

/** One wire of the servo lead as a tube along SVG-style (x, y, z) points. */
const wire = (kit, points, color) => {
    const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, -y, z)), false, 'centripetal');
    const mesh = new Mesh(new TubeGeometry(curve, 80, 1.35, 8, false), kit.mat({color, rough: 0.5}));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

/** SG90 servo with its lead plugged onto the RJ11 carrier. */
export default {
    id: 'servo',
    name: 'SG90 Servo',
    category: 'output',
    defaultPort: 'D13',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'SG90 SERVO',
        labelAt: [57, 42],
        labelSize: 3.6,
        holes: [[W - 6, 6]],
        silk: CARRIER_SILK
    },
    build (kit, g) {
        // right-angle header and the 3-pin plug pushed onto it
        const span = PITCH * 3;
        g.add(kit.box({x: HEADER.x, y: CY - (span / 2), w: HEADER.w, d: span, h: HEADER.h, z: TOP, color: BLACK}));
        [0, 1, 2].forEach(i => g.add(kit.box({
            x: HEADER.x + HEADER.w,
            y: CY + ((i - 1) * PITCH) - 0.7,
            w: 2.4,
            d: 1.4,
            h: 1.4,
            z: TOP + 2.3,
            color: {color: '#d6b25a', rough: 0.3, metal: 0.85}
        })));
        g.add(kit.box({
            x: PLUG.x,
            y: CY - (span / 2),
            w: PLUG.len,
            d: span,
            h: PLUG.h,
            z: TOP + 0.3,
            color: {color: '#151515', rough: 0.5},
            faces: {t: {map: kit.tex.svg('servo-plug', PLUG.len, span, `<rect width="${PLUG.len}" height="${span}" fill="#1a1a1a"/>` +
                '<path d="M 3 2 L 6 4 L 3 6 Z" fill="#3a3a3a"/>' +
                [0, 1, 2].map(i => `<rect x="${PLUG.len - 9}" y="${(i * PITCH) + 1.6}" width="7" height="2.9" rx="0.6" fill="#0d0d0d"/>`).join(''),
            {ppu: 8, base: '#1a1a1a'}), rough: 0.5}}
        }));

        // the lead: three wires fan in from the plug, run along the table and up into the servo
        const exitX = PLUG.x + PLUG.len;
        WIRE_COLORS.forEach((color, i) => {
            const k = i - 1;
            g.add(wire(kit, [
                [exitX - 2, CY + (k * PITCH), TOP + 3.3],
                [exitX + 6, CY + (k * 4.2), TOP + 2.6],
                [exitX + 16, CY + 6 + (k * 2.9), 1.4],
                [S.x - 22, CY + 10 + (k * 2.9), 1.4],
                [S.x - 8, CY + 3 + (k * 2.9), 5],
                [S.x + 1, CY + (k * 2.9), 9]
            ], color));
        });

        // case: lower body, tab plate, upper body, then the gear top
        g.add(kit.box({x: S.x, y: S.y, w: S.w, d: S.d, h: TAB.z, z: 0, color: BODY}));
        g.add(kit.box({x: S.x - TAB.reach, y: S.y, w: S.w + (TAB.reach * 2), d: S.d, h: TAB.h, z: TAB.z, color: BODY}));
        g.add(kit.box({x: S.x, y: S.y, w: S.w, d: S.d, h: S.h - TAB.z - TAB.h, z: TAB.z + TAB.h, color: BODY}));
        [S.x - (TAB.reach / 2) - 0.5, S.x + S.w + (TAB.reach / 2) + 0.5].forEach(cx => g.add(kit.cylinder({
            cx,
            cy: CY,
            r: 2.2,
            z0: TAB.z - 0.05,
            z1: TAB.z + TAB.h + 0.08,
            side: {color: '#0d1b33', rough: 0.6},
            seg: 16
        })));
        g.add(kit.sideDecal({
            face: 's',
            x: S.x,
            y: S.y,
            w: S.w,
            d: S.d,
            z: 0,
            h: TAB.z,
            material: {map: kit.tex.svg('sg90-sticker', 54, 54.5, STICKER_SVG, {ppu: 8, base: '#1d4fa8'}), rough: 0.5}
        }));
        g.add(kit.cylinder({cx: SHAFT_X, cy: CY, r: 14, z0: S.h, z1: S.h + 9.6, seg: 40, side: BODY, top: BODY}));
        g.add(kit.cylinder({cx: S.x + 18, cy: CY, r: 6.5, z0: S.h, z1: S.h + 5, seg: 28, side: BODY, top: BODY}));

        // output spline, horn and its hub screw
        g.add(kit.cylinder({cx: SHAFT_X, cy: CY, r: 2.6, z0: S.h + 9.6, z1: HORN.z, seg: 18, side: WHITE}));
        g.add(kit.slab({
            x: SHAFT_X - (HORN.hub / 2),
            y: CY - (HORN.len / 2),
            w: HORN.hub,
            d: HORN.len,
            h: HORN.h,
            z: HORN.z,
            outline: HORN_OUTLINE,
            top: {map: kit.tex.svg('sg90-horn', HORN.hub, HORN.len, HORN_SVG, {ppu: 10, base: '#f1f2ee'}), rough: 0.5},
            side: WHITE
        }));
        g.add(kit.cylinder({
            cx: SHAFT_X,
            cy: CY,
            r: 5,
            z0: HORN.z,
            z1: HORN.z + HORN.h + 1.4,
            seg: 28,
            side: WHITE,
            top: {map: kit.tex.svg('sg90-hub', 10, 10, '<rect width="10" height="10" fill="#f1f2ee"/>' +
                '<circle cx="5" cy="5" r="2.2" fill="#8d9093"/><path d="M3.6 5 H6.4 M5 3.6 V6.4" stroke="#3a3c3e" stroke-width="0.6"/>',
            {ppu: 12, base: '#f1f2ee'}), rough: 0.4}
        }));
    }
};
