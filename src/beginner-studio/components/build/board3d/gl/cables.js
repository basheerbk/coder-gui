import {CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3} from 'three';

import {TABLE_Z} from './boardModel';

const RADIUS = 2.6;
const PLUG = {len: 12, w: 11, h: 8, boot: 8, inside: 4};
const BACK = PLUG.len + PLUG.boot - PLUG.inside;

const smooth = t => {
    const k = Math.max(0, Math.min(1, t));
    return k * k * (3 - (2 * k));
};

/** RJ11 plug in its own frame: tip at the origin, pointing along +x. */
const buildPlug = (kit, color) => {
    const g = new Group();
    g.add(kit.box({
        x: -PLUG.len,
        y: -PLUG.w / 2,
        w: PLUG.len,
        d: PLUG.w,
        h: PLUG.h,
        z: -PLUG.h / 2,
        color: {color: '#e9eef3', rough: 0.25, opacity: 0.92}
    }));
    g.add(kit.box({
        x: -PLUG.len + 2,
        y: -3,
        w: PLUG.len - 3,
        d: 6,
        h: 1.4,
        z: PLUG.h / 2,
        color: {color, rough: 0.35}
    }));
    g.add(kit.box({
        x: -PLUG.len - PLUG.boot,
        y: -(PLUG.w - 3) / 2,
        w: PLUG.boot,
        d: PLUG.w - 3,
        h: PLUG.h - 2,
        z: -(PLUG.h - 2) / 2,
        color: {color: '#9aa5b1', rough: 0.5}
    }));
    return g;
};

/** Plug seated in a socket mouth at (x, y, z), pushed in along world direction (ix, iy). */
const placePlug = (plug, {x, y, z}, ix, iy) => {
    plug.position.set(x + (ix * PLUG.inside), -(y + (iy * PLUG.inside)), z);
    plug.rotation.z = Math.atan2(-iy, ix);
    return plug;
};

/**
 * Cable from a board jack to a module socket. `from`/`to` are world points with height z and the
 * jack's outward direction; the bend handle (world x, y) shapes the run along the table like the
 * edit view's quadratic curve.
 */
const buildCable = (kit, {from, to, handle, color}) => {
    const group = new Group();
    const [dx, dy] = from.dir;
    const start = {x: from.x + (dx * BACK), y: from.y + (dy * BACK)};
    const end = {x: to.x - (dx * BACK), y: to.y - (dy * BACK)};
    const a = {x: start.x + (dx * 10), y: start.y + (dy * 10)};
    const b = {x: end.x - (dx * 10), y: end.y - (dy * 10)};
    const hx = handle ? handle.x : (from.x + to.x) / 2;
    const hy = handle ? handle.y : (from.y + to.y) / 2;
    const cx = (2 * hx) - ((a.x + b.x) / 2);
    const cy = (2 * hy) - ((a.y + b.y) / 2);
    const floor = TABLE_Z + RADIUS;

    const pts = [new Vector3(start.x, -start.y, from.z)];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = (u * u * a.x) + (2 * u * t * cx) + (t * t * b.x);
        const y = (u * u * a.y) + (2 * u * t * cy) + (t * t * b.y);
        const z = t < 0.5 ?
            from.z + ((floor - from.z) * smooth(t / 0.38)) :
            to.z + ((floor - to.z) * smooth((1 - t) / 0.38));
        pts.push(new Vector3(x, -y, z));
    }
    pts.push(new Vector3(end.x, -end.y, to.z));

    const curve = new CatmullRomCurve3(pts, false, 'centripetal');
    const tube = new Mesh(new TubeGeometry(curve, 96, RADIUS, 10, false), kit.mat({color, rough: 0.45}));
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    group.add(placePlug(buildPlug(kit, color), from, -dx, -dy));
    group.add(placePlug(buildPlug(kit, color), to, dx, dy));
    return group;
};

export default buildCable;
