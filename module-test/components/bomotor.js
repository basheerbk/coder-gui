import {Group} from 'three';

import {ridgeTexture} from '../lib/parts.js';
import {lead} from '../lib/breakout.js';

/*
 * BO motor with wheel: the yellow plastic gearbox with its silver motor, and a 65 mm wheel
 * (yellow hub, black tread) on the output shaft, stood as it sits on a robot. Leads end in
 * stripped tips for a driver's screw terminal. A loose part: it plugs into a motor driver, not a jack.
 */
const YELLOW = {color: '#f4c21b', rough: 0.55};
const GB = {x: 0, y: 0, w: 89, d: 53, h: 43};
const AXLE = {x: 22, z: 78};
const WHEEL = {r: 78, width: 62, rim: 58};

/** Cylinder whose axis runs along y (SVG-style y), centred on (cx, cy, cz). */
const alongY = (kit, {cx, cy, cz, r, len, side, top, bottom, seg = 48}) => {
    const mesh = kit.cylinder({cx: 0, cy: 0, r, z0: -len / 2, z1: len / 2, side, top, bottom, seg});
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, -cy, cz);
    return mesh;
};

/** Cylinder along x from x0 to x1 at (cy, cz). */
const alongX = (kit, {x0, x1, cy, cz, r, side, top, bottom, seg = 40}) => {
    const mesh = kit.cylinder({cx: 0, cy: 0, r, z0: 0, z1: x1 - x0, side, top, bottom, seg});
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, -cy, cz);
    return mesh;
};

const HUB_SVG = (() => {
    let s = '<rect width="120" height="120" fill="#f4c21b"/>';
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = 60 + (36 * Math.cos(a));
        const y = 60 + (36 * Math.sin(a));
        s += `<circle cx="${x}" cy="${y}" r="11" fill="#c99a0c"/>`;
    }
    return `${s}<circle cx="60" cy="60" r="12" fill="#e0b010"/><circle cx="60" cy="60" r="4" fill="#3a3a3a"/>`;
})();

const buildScene = kit => {
    const g = new Group();
    g.name = 'bomotor';
    const z0 = AXLE.z - (GB.h / 2);
    // gearbox, motor can with its end cap and tabs
    g.add(kit.box({x: GB.x, y: GB.y, w: GB.w, d: GB.d, h: GB.h, z: z0, color: YELLOW}));
    g.add(kit.box({x: GB.x + 8, y: GB.y - 4, w: 12, d: 4, h: 10, z: z0 + 16, color: YELLOW}));
    g.add(alongX(kit, {x0: GB.w, x1: GB.w + 60, cy: GB.d / 2, cz: AXLE.z, r: 24, side: {color: '#c6c9cc', rough: 0.3, metal: 0.85}}));
    g.add(alongX(kit, {x0: GB.w + 60, x1: GB.w + 66, cy: GB.d / 2, cz: AXLE.z, r: 22, side: {color: '#8a5a2b', rough: 0.6}, top: {color: '#7a4e26', rough: 0.6}}));
    [-8, 8].forEach(o => g.add(kit.box({x: GB.w + 66, y: (GB.d / 2) + o - 2, w: 6, d: 4, h: 0.8, z: AXLE.z + 10, color: {color: '#d4d6d8', metal: 0.8, rough: 0.3}})));
    lead(kit, g, ['#d0302a', '#151515'], k => [
        [GB.w + 70, (GB.d / 2) + (k * 16), AXLE.z + 10.4],
        [GB.w + 90, (GB.d / 2) + (k * 10), AXLE.z],
        [GB.w + 110, (GB.d / 2) + 6 + (k * 3), 20],
        [GB.w + 150, (GB.d / 2) + 12 + (k * 3), 1.3]
    ], 1.4);
    // output shaft and the wheel on the -y side
    const wy = -WHEEL.width / 2 - 8;
    g.add(alongY(kit, {cx: AXLE.x, cy: -4, cz: AXLE.z, r: 2.6, len: 16, side: {color: '#f6f6f2', rough: 0.4}}));
    g.add(alongY(kit, {
        cx: AXLE.x,
        cy: wy,
        cz: AXLE.z,
        r: WHEEL.r,
        len: WHEEL.width,
        seg: 64,
        side: {map: ridgeTexture(kit, 'tread', Math.PI * 2 * WHEEL.r, WHEEL.width, 7, '#1a1a1a', '#0a0a0a'), rough: 0.85},
        top: {color: '#181818', rough: 0.8},
        bottom: {color: '#181818', rough: 0.8}
    }));
    g.add(alongY(kit, {
        cx: AXLE.x,
        cy: wy,
        cz: AXLE.z,
        r: WHEEL.rim,
        len: WHEEL.width + 1.2,
        seg: 48,
        side: YELLOW,
        top: {map: kit.tex.svg('bo-hub', 120, 120, HUB_SVG, {ppu: 4, base: '#f4c21b'}), rough: 0.5},
        bottom: {map: kit.tex.svg('bo-hub', 120, 120, HUB_SVG, {ppu: 4, base: '#f4c21b'}), rough: 0.5}
    }));
    return g;
};

export default {
    id: 'bomotor',
    name: 'BO Motor with Wheel',
    category: 'output',
    kind: 'part',
    buildScene
};
