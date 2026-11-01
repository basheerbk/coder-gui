import {AdditiveBlending, Color, DoubleSide, Matrix4, Vector3} from 'three';

/*
 * Vector top view of any board-space object (x east, y north, z up): every face that points up is
 * flattened to an SVG path and drawn lowest first. Faces with an SVG-sourced texture reuse that
 * markup, clipped to the face, so silk, labels and chip markings stay vector.
 * Output is in board units with SVG's y down, the same frame as the studio's 2D board.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const UP_MIN = 0.02;
const FLAT = 0.995;
const BAND = 0.75;
const LIGHT = new Vector3(-0.35, 0.45, 1).normalize();
let svgCount = 0;

const num = n => {
    const r = Math.round(n * 100) / 100;
    return Object.is(r, -0) ? '0' : String(r);
};

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Give every id in a markup fragment a prefix so fragments can share one document. */
const prefixIds = (markup, prefix) => markup
    .replace(/\bid="([^"]+)"/g, (m, id) => `id="${prefix}${id}"`)
    .replace(/url\(\s*#([^)\s]+)\s*\)/g, (m, id) => `url(#${prefix}${id})`)
    .replace(/(\s(?:xlink:)?href)="#([^"]+)"/g, (m, attr, id) => `${attr}="#${prefix}${id}"`);

/** A complete SVG file as a fragment that fills its parent viewport. */
const embedFile = markup => markup
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="100%" height="100%">`);

const colorOf = material => {
    const c = material.color ? material.color.clone() : new Color(1, 1, 1);
    if (material.emissive && material.emissiveIntensity > 0) {
        c.add(material.emissive.clone().multiplyScalar(material.emissiveIntensity));
    }
    return c;
};

const shaded = (color, f) => {
    if (f === 1) {
        return `#${color.getHexString()}`;
    }
    const srgb = {};
    color.getRGB(srgb);
    const ch = v => Math.max(0, Math.min(255, Math.round((f > 1 ? v + ((1 - v) * (f - 1)) : v * f) * 255)));
    return `rgb(${ch(srgb.r)},${ch(srgb.g)},${ch(srgb.b)})`;
};

const isWhite = c => c.r > 0.999 && c.g > 0.999 && c.b > 0.999;

/** Affine (a b c d e f) taking texture image coordinates to output coordinates, from one triangle. */
const imageToOut = (tri, w, h) => {
    const P = tri.map(p => [p.u * w, (1 - p.v) * h]);
    const det = (P[0][0] * (P[1][1] - P[2][1])) - (P[0][1] * (P[1][0] - P[2][0])) + ((P[1][0] * P[2][1]) - (P[2][0] * P[1][1]));
    if (Math.abs(det) < 1e-9) {
        return null;
    }
    const solve = vals => {
        const [v0, v1, v2] = vals;
        const p = (v0 * (P[1][1] - P[2][1])) - (P[0][1] * (v1 - v2)) + ((v1 * P[2][1]) - (v2 * P[1][1]));
        const q = (P[0][0] * (v1 - v2)) - (v0 * (P[1][0] - P[2][0])) + ((P[1][0] * v2) - (P[2][0] * v1));
        const r = (P[0][0] * ((P[1][1] * v2) - (P[2][1] * v1))) - (P[0][1] * ((P[1][0] * v2) - (P[2][0] * v1))) +
            (v0 * ((P[1][0] * P[2][1]) - (P[2][0] * P[1][1])));
        return [p / det, q / det, r / det];
    };
    const [a, c, e] = solve(tri.map(p => p.X));
    const [b, d, f] = solve(tri.map(p => p.Y));
    return [a, b, c, d, e, f];
};

/** Upward faces of every visible mesh under root, grouped into drawable items. */
const collect = (root, shade) => {
    root.updateWorldMatrix(true, true);
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const m = new Matrix4();
    const va = new Vector3();
    const vb = new Vector3();
    const vc = new Vector3();
    const e1 = new Vector3();
    const e2 = new Vector3();
    const n = new Vector3();
    const items = new Map();
    let order = 0;

    root.traverseVisible(mesh => {
        if (!mesh.isMesh || !mesh.geometry || mesh.userData.skipTop) {
            return;
        }
        const geom = mesh.geometry;
        const pos = geom.attributes.position;
        if (!pos) {
            return;
        }
        const uv = geom.attributes.uv;
        const index = geom.index;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const groups = geom.groups.length ? geom.groups : [{start: 0, count: index ? index.count : pos.count, materialIndex: 0}];
        m.multiplyMatrices(toRoot, mesh.matrixWorld);
        const mirrored = m.determinant() < 0;
        const meshOrder = order++;

        groups.forEach((group, gi) => {
            const material = materials[group.materialIndex || 0];
            if (!material || !material.visible || material.isShadowMaterial || material.opacity === 0) {
                return;
            }
            const twoSided = material.side === DoubleSide;
            const end = Math.min(group.start + group.count, index ? index.count : pos.count);
            for (let i = group.start; i + 2 < end; i += 3) {
                const ia = index ? index.getX(i) : i;
                const ib = index ? index.getX(i + 1) : i + 1;
                const ic = index ? index.getX(i + 2) : i + 2;
                va.fromBufferAttribute(pos, ia).applyMatrix4(m);
                vb.fromBufferAttribute(pos, ib).applyMatrix4(m);
                vc.fromBufferAttribute(pos, ic).applyMatrix4(m);
                n.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va));
                const len = n.length();
                if (len < 1e-9) {
                    continue;
                }
                let nz = (mirrored ? -n.z : n.z) / len;
                if (twoSided) {
                    nz = Math.abs(nz);
                }
                if (nz <= UP_MIN) {
                    continue;
                }
                n.multiplyScalar((mirrored ? -1 : 1) / len);
                if (twoSided && n.z < 0) {
                    n.negate();
                }
                const zTop = Math.max(va.z, vb.z, vc.z);
                const flat = nz >= FLAT;
                let f = 1;
                if (shade && !flat) {
                    f = Math.max(0.45, Math.min(1.12, 0.45 + (0.55 * n.dot(LIGHT) / LIGHT.z)));
                    f = Math.round(f / 0.06) * 0.06;
                }
                const key = flat ? `${mesh.id}:${gi}:flat:${num(zTop)}` : `${mesh.id}:${gi}:${Math.floor(zTop / BAND)}:${f}`;
                let item = items.get(key);
                if (!item) {
                    item = {material, flat, f, z: zTop, order: meshOrder, tris: []};
                    items.set(key, item);
                }
                item.z = Math.max(item.z, zTop);
                const corner = (v, k) => ({X: v.x, Y: -v.y, u: uv ? uv.getX(k) : 0, v: uv ? uv.getY(k) : 0});
                item.tris.push([corner(va, ia), corner(vb, ib), corner(vc, ic)]);
            }
        });
    });
    return Array.from(items.values()).sort((p, q) => (p.z - q.z) || (p.order - q.order));
};

/**
 * Standalone SVG string of root seen from straight above.
 * options: scale (px per board unit, default 4), padding (units, default 4), background (CSS colour),
 * shade (darken sloped faces, default true), title, embedAsset(asset) => SVG file text (inline
 * file-based textures instead of linking them), idPrefix (ids must be unique when several SVGs are
 * inlined in one page; defaults to a fresh "tbN-").
 */
const objectToTopSVG = (root, {scale = 4, padding = 4, background = null, shade = true, title, embedAsset, idPrefix} = {}) => {
    const P = idPrefix || `tb${++svgCount}-`;
    const items = collect(root, shade);
    const defs = [];
    const body = [];
    const textures = new Map();
    let clipCount = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const textureDef = tex => {
        if (textures.has(tex.uuid)) {
            return textures.get(tex.uuid);
        }
        const id = `${P}t${textures.size}`;
        let def = null;
        const src = tex.userData.svg;
        const asset = tex.userData.asset;
        if (src) {
            def = {id, w: src.w, h: src.h};
            defs.push(`<svg id="${id}" width="${num(src.w)}" height="${num(src.h)}" viewBox="0 0 ${src.w} ${src.h}" ` +
                `preserveAspectRatio="none" font-family="${escapeAttr(src.font || 'sans-serif')}">${prefixIds(src.inner, `${id}-`)}</svg>`);
        } else if (asset) {
            def = {id, w: asset.w, h: asset.h};
            const inner = embedAsset ? prefixIds(embedFile(embedAsset(asset)), `${id}-`) :
                `<image href="${escapeAttr(asset.url)}" width="${asset.w}" height="${asset.h}" preserveAspectRatio="none"/>`;
            defs.push(`<svg id="${id}" width="${num(asset.w)}" height="${num(asset.h)}" viewBox="0 0 ${asset.w} ${asset.h}" ` +
                `preserveAspectRatio="none">${inner}</svg>`);
        }
        textures.set(tex.uuid, def);
        return def;
    };

    items.forEach(item => {
        let d = '';
        item.tris.forEach(tri => {
            tri.forEach(p => {
                minX = Math.min(minX, p.X);
                minY = Math.min(minY, p.Y);
                maxX = Math.max(maxX, p.X);
                maxY = Math.max(maxY, p.Y);
            });
            d += `M${num(tri[0].X)} ${num(tri[0].Y)}L${num(tri[1].X)} ${num(tri[1].Y)}L${num(tri[2].X)} ${num(tri[2].Y)}Z`;
        });
        const mat = item.material;
        const color = colorOf(mat);
        const opacity = mat.transparent || mat.opacity < 1 ? mat.opacity : 1;
        const style = [];
        if (mat.blending === AdditiveBlending) {
            style.push('mix-blend-mode:screen');
        }
        const opAttr = opacity < 1 ? ` opacity="${num(opacity)}"` : '';
        const styleAttr = style.length ? ` style="${style.join(';')}"` : '';
        // curved surfaces are split into bands; a hairline of the same colour hides the joins
        const seam = item.flat ? '' : ` stroke="${shaded(color, item.f)}" stroke-width="0.12" stroke-linejoin="round"`;

        const tex = mat.map ? textureDef(mat.map) : null;
        const affine = tex && imageToOut(item.tris.find(t => imageToOut(t, tex.w, tex.h)) || item.tris[0], tex.w, tex.h);
        if (!tex || !affine) {
            body.push(`<path d="${d}" fill="${shaded(color, item.f)}"${seam}${opAttr}${styleAttr}/>`);
            return;
        }
        const clip = `${P}c${clipCount++}`;
        defs.push(`<clipPath id="${clip}"><path d="${d}"/></clipPath>`);
        const use = `<use href="#${tex.id}" width="${num(tex.w)}" height="${num(tex.h)}" transform="matrix(${affine.map(v => +v.toFixed(5)).join(' ')})"/>`;
        if (mat.blending === AdditiveBlending && !isWhite(color)) {
            defs.push(`<mask id="${clip}m" maskUnits="userSpaceOnUse" x="-1e5" y="-1e5" width="2e5" height="2e5">${use}</mask>`);
            body.push(`<g clip-path="url(#${clip})"${opAttr}${styleAttr}><path d="${d}" fill="#${color.getHexString()}" mask="url(#${clip}m)"/></g>`);
            return;
        }
        const tint = isWhite(color) ? '' : `<path d="${d}" fill="${shaded(color, 1)}" style="mix-blend-mode:multiply"/>`;
        const dim = item.f < 1 ? `<path d="${d}" fill="#000" opacity="${num(1 - item.f)}"/>` : '';
        body.push(`<g clip-path="url(#${clip})"${opAttr}${styleAttr}>${use}${tint}${dim}</g>`);
    });

    if (!Number.isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = 1;
        maxY = 1;
    }
    const vx = minX - padding;
    const vy = minY - padding;
    const vw = (maxX - minX) + (padding * 2);
    const vh = (maxY - minY) + (padding * 2);
    const bg = background ? `<rect x="${num(vx)}" y="${num(vy)}" width="${num(vw)}" height="${num(vh)}" fill="${escapeAttr(background)}"/>` : '';
    return `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(vw * scale)}" height="${num(vh * scale)}" ` +
        `viewBox="${num(vx)} ${num(vy)} ${num(vw)} ${num(vh)}">` +
        `${title ? `<title>${escapeText(title)}</title>` : ''}<defs>${defs.join('')}</defs>` +
        `<g style="isolation:isolate">${bg}${body.join('')}</g></svg>`;
};

export {objectToTopSVG};
export default objectToTopSVG;
