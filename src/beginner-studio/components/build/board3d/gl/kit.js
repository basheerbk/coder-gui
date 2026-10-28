import {
    AdditiveBlending,
    BoxGeometry,
    BufferGeometry,
    CylinderGeometry,
    DoubleSide,
    ExtrudeGeometry,
    Float32BufferAttribute,
    FrontSide,
    LatheGeometry,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    NormalBlending,
    PlaneGeometry,
    Shape,
    ShapeGeometry,
    Vector2
} from 'three';

/**
 * Board space: x east, y north (the inverse of SVG's y-down), z up, in board units.
 * Everything is built in a root group that the scene turns so z points up.
 * at(x, y) converts an SVG/world point to board space.
 */
const at = (x, y) => [x, -y];

const roundedRect = (w, d, r) => {
    const s = new Shape();
    const rr = Math.max(0, Math.min(r, w / 2, d / 2));
    s.moveTo(rr, 0);
    s.lineTo(w - rr, 0);
    s.quadraticCurveTo(w, 0, w, rr);
    s.lineTo(w, d - rr);
    s.quadraticCurveTo(w, d, w - rr, d);
    s.lineTo(rr, d);
    s.quadraticCurveTo(0, d, 0, d - rr);
    s.lineTo(0, rr);
    s.quadraticCurveTo(0, 0, rr, 0);
    return s;
};

const markShared = thing => {
    thing.userData.shared = true;
    return thing;
};

/** Frees everything under `root` that isn't cached in a Kit or TextureBank. */
const disposeTree = root => {
    root.traverse(obj => {
        if (obj.geometry && !obj.geometry.userData.shared) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                if (m.userData.shared) {
                    return;
                }
                if (m.map && !m.map.userData.shared) {
                    m.map.dispose();
                }
                m.dispose();
            });
        }
    });
};

/** Shared materials, geometries and the part builders that use them. */
class Kit {
    constructor (textures) {
        this.tex = textures;
        this.mats = new Map();
        this.geos = new Map();
    }

    geo (key, make) {
        if (!this.geos.has(key)) {
            this.geos.set(key, markShared(make()));
        }
        return this.geos.get(key);
    }

    /** Standard (lit) material; spec is a colour string or {color, rough, metal, map, emissive, ...}. */
    mat (spec) {
        if (spec && spec.isMaterial) {
            return spec;
        }
        const s = typeof spec === 'string' ? {color: spec} : (spec || {});
        const key = [
            'std', s.color, s.rough, s.metal, s.map ? s.map.uuid : '', s.emissive, s.emissiveIntensity,
            s.opacity, s.side, s.alpha
        ].join('|');
        if (!this.mats.has(key)) {
            const m = new MeshStandardMaterial({
                color: s.map && !s.color ? '#ffffff' : (s.color || '#ffffff'),
                roughness: s.rough === undefined ? 0.6 : s.rough,
                metalness: s.metal === undefined ? 0 : s.metal,
                map: s.map || null,
                emissive: s.emissive || '#000000',
                emissiveIntensity: s.emissiveIntensity === undefined ? 1 : s.emissiveIntensity,
                transparent: s.opacity !== undefined && s.opacity < 1 ? true : Boolean(s.map && s.alpha),
                opacity: s.opacity === undefined ? 1 : s.opacity,
                side: s.side === undefined ? 0 : s.side
            });
            this.mats.set(key, markShared(m));
        }
        return this.mats.get(key);
    }

    /** Unlit material for glows, printed decals and anything that should keep its exact colour. */
    basic ({color = '#ffffff', map = null, opacity = 1, additive = false, doubleSide = false}) {
        const key = ['basic', color, map ? map.uuid : '', opacity, additive, doubleSide].join('|');
        if (!this.mats.has(key)) {
            const m = new MeshBasicMaterial({
                color,
                map,
                transparent: true,
                opacity,
                depthWrite: false,
                blending: additive ? AdditiveBlending : NormalBlending,
                side: doubleSide ? DoubleSide : FrontSide,
                toneMapped: false
            });
            this.mats.set(key, markShared(m));
        }
        return this.mats.get(key);
    }

    /**
     * Cuboid with its footprint at (x, y) world units, w across, d deep, h tall, base at z.
     * faces: {t, s, n, e, w, b} material specs; `color` fills any face not listed.
     */
    box ({x, y, w, d, h, z = 0, color = '#888888', faces = {}, shadow = true}) {
        const geom = this.geo(`box:${w}:${d}:${h}`, () => new BoxGeometry(w, d, h));
        const pick = k => this.mat(faces[k] || color);
        // BoxGeometry face order: +x, -x, +y, -y, +z, -z
        const mesh = new Mesh(geom, [pick('e'), pick('w'), pick('n'), pick('s'), pick('t'), pick('b')]);
        const [px, py] = at(x + (w / 2), y + (d / 2));
        mesh.position.set(px, py, z + (h / 2));
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        return mesh;
    }

    /** Rounded-corner slab; the top texture spans the whole footprint (u: west→east, v: south→north). */
    slab ({x, y, w, d, h, z = 0, r = 2, top, side, shadow = true}) {
        const geom = this.geo(`slab:${w}:${d}:${h}:${r}`, () => {
            const g = new ExtrudeGeometry(roundedRect(w, d, r), {depth: h, bevelEnabled: false, curveSegments: 6});
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
                uv.setXY(i, uv.getX(i) / w, uv.getY(i) / d);
            }
            return g;
        });
        const mesh = new Mesh(geom, [this.mat(top), this.mat(side)]);
        const [px, py] = at(x, y + d);
        mesh.position.set(px, py, z);
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        return mesh;
    }

    /** Upright cylinder centred at (cx, cy) from z0 to z1. */
    cylinder ({cx, cy, r, z0, z1, side, top, bottom, seg = 32, r1}) {
        const h = Math.max(0.01, z1 - z0);
        const rTop = r1 === undefined ? r : r1;
        const geom = this.geo(`cyl:${rTop}:${r}:${h}:${seg}`, () => {
            const g = new CylinderGeometry(rTop, r, h, seg, 1, false);
            g.rotateX(Math.PI / 2);
            return g;
        });
        const sideM = this.mat(side);
        const mesh = new Mesh(geom, [sideM, this.mat(top || side), this.mat(bottom || side)]);
        const [px, py] = at(cx, cy);
        mesh.position.set(px, py, (z0 + z1) / 2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    /** Solid of revolution from [radius, height] pairs, standing at (cx, cy) on z. */
    lathe ({key, cx, cy, z = 0, profile, material, seg = 32}) {
        const geom = this.geo(`lathe:${key}:${seg}`, () => {
            const g = new LatheGeometry(profile.map(([r, hh]) => new Vector2(r, hh)), seg);
            g.rotateX(Math.PI / 2);
            return g;
        });
        const mesh = new Mesh(geom, this.mat(material));
        const [px, py] = at(cx, cy);
        mesh.position.set(px, py, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    /** Flat horizontal decal with its footprint at (x, y), facing up at height z. */
    decal ({x, y, w, d, z, material, receive = true}) {
        const geom = this.geo(`plane:${w}:${d}`, () => new PlaneGeometry(w, d));
        const mesh = new Mesh(geom, material.isMaterial ? material : this.mat(material));
        const [px, py] = at(x + (w / 2), y + (d / 2));
        mesh.position.set(px, py, z);
        mesh.receiveShadow = receive;
        return mesh;
    }

    /**
     * Upright decal on the outside of a box face. The box footprint is (x, y, w, d), its base at z,
     * h tall; `face` is 's' | 'n' | 'e' | 'w'; span is the decal width along the face (centred).
     */
    sideDecal ({face, x, y, w, d, z, h, span, material}) {
        const along = face === 's' || face === 'n' ? w : d;
        const width = span || along;
        const geom = this.geo(`side:${width}:${h}`, () => {
            const g = new PlaneGeometry(width, h);
            g.rotateX(Math.PI / 2);
            return g;
        });
        const mesh = new Mesh(geom, material.isMaterial ? material : this.mat(material));
        const eps = 0.04;
        const [cx, cy] = at(x + (w / 2), y + (d / 2));
        const rot = {s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2}[face];
        const off = {s: [0, -(d / 2) - eps], n: [0, (d / 2) + eps], e: [(w / 2) + eps, 0], w: [-(w / 2) - eps, 0]}[face];
        mesh.rotation.z = rot;
        mesh.position.set(cx + off[0], cy + off[1], z + (h / 2));
        return mesh;
    }

    /** Rounded-rectangle outline ring around a footprint (for jack highlights). */
    ring ({w, d, r, width}) {
        return this.geo(`ring:${w}:${d}:${r}:${width}`, () => {
            const outer = roundedRect(w + (width * 2), d + (width * 2), r + width);
            const hole = roundedRect(w, d, r);
            const inner = new Shape(hole.getPoints(6).map(p => new Vector2(p.x + width, p.y + width)).reverse());
            outer.holes.push(inner);
            const g = new ShapeGeometry(outer, 6);
            g.translate(-(w / 2) - width, -(d / 2) - width, 0);
            return g;
        });
    }

    /**
     * Flat ribbon along a polyline of world points, `width` wide at height z.
     * Not cached: each live trace has its own.
     */
    static ribbon (points, width, z) {
        const pos = [];
        const idx = [];
        const half = width / 2;
        for (let i = 0; i < points.length; i++) {
            const [ax, ay] = points[Math.max(0, i - 1)];
            const [bx, by] = points[Math.min(points.length - 1, i + 1)];
            const dx = bx - ax;
            const dy = by - ay;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const [px, py] = points[i];
            pos.push(px + (nx * half), -(py + (ny * half)), z, px - (nx * half), -(py - (ny * half)), z);
            if (i > 0) {
                const k = i * 2;
                idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
            }
        }
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    /** Free cached materials matching `test` (e.g. ones whose texture was evicted). */
    dropMaterials (test) {
        this.mats.forEach((m, key) => {
            if (test(m)) {
                m.dispose();
                this.mats.delete(key);
            }
        });
    }

    dispose () {
        this.mats.forEach(m => m.dispose());
        this.geos.forEach(g => g.dispose());
        this.mats.clear();
        this.geos.clear();
    }
}

export {at, roundedRect, disposeTree};
export default Kit;
