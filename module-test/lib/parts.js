import {AdditiveBlending, Group, MeshBasicMaterial} from 'three';

import {JACK, JACK_H, PCB_H} from './board-data.js';

/** Height of a module's PCB surface; module parts stand on it. */
const TOP = PCB_H;
const JACK_R = 3.5;
const BLACK = {color: '#151617', rough: 0.45};
const METAL = {color: '#c9ccce', rough: 0.32, metal: 0.85};

// ---- Textures ---------------------------------------------------------------

/** Soft round glow, white so a material colour can tint it. */
const glowTexture = kit => kit.tex.canvas('glow', 16, 16, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}, {
    ppu: 8,
    svg: '<defs><radialGradient id="glow"><stop offset="0" stop-color="#fff"/>' +
        '<stop offset="0.35" stop-color="#fff" stop-opacity="0.42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
        '</radialGradient></defs><rect width="16" height="16" fill="url(#glow)"/>'
});

/** A glow decal with its own material so its opacity can animate. */
const glowDecal = (kit, {cx, cy, size, z, color, opacity = 0.9}) => {
    const material = new MeshBasicMaterial({
        color,
        map: glowTexture(kit),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false
    });
    return kit.decal({x: cx - (size / 2), y: cy - (size / 2), w: size, d: size, z, material, receive: false});
};

/** Two-tone SMD top: metal end caps around a body. */
const passiveTexture = (kit, kind, horizontal) => kit.tex.canvas(`passive:${kind}:${horizontal ? 'h' : 'v'}`, 12, 12, (ctx, w, h) => {
    ctx.fillStyle = kind === 'C' ? '#b08657' : '#161616';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d2d3d0';
    if (horizontal) {
        ctx.fillRect(0, 0, w * 0.22, h);
        ctx.fillRect(w * 0.78, 0, w * 0.22, h);
    } else {
        ctx.fillRect(0, 0, w, h * 0.22);
        ctx.fillRect(0, h * 0.78, w, h * 0.22);
    }
}, {
    svg: `<rect width="12" height="12" fill="${kind === 'C' ? '#b08657' : '#161616'}"/>` + (horizontal ?
        '<rect width="2.64" height="12" fill="#d2d3d0"/><rect x="9.36" width="2.64" height="12" fill="#d2d3d0"/>' :
        '<rect width="12" height="2.64" fill="#d2d3d0"/><rect y="9.36" width="12" height="2.64" fill="#d2d3d0"/>')
});

/** Dotted wire mesh over a base colour, drawn to scale (pitch in board units). */
const meshTexture = (kit, key, w, h, pitch, base, dot) => kit.tex.canvas(`mesh:${key}`, w, h, (ctx, cw, ch) => {
    const s = cw / w;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = dot;
    const r = pitch * 0.3 * s;
    for (let y = pitch / 2; y < h; y += pitch) {
        for (let x = pitch / 2; x < w; x += pitch) {
            ctx.beginPath();
            ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}, {
    ppu: 10,
    svg: `<defs><pattern id="mesh" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse">` +
        `<circle cx="${pitch / 2}" cy="${pitch / 2}" r="${pitch * 0.3}" fill="${dot}"/></pattern></defs>` +
        `<rect width="${w}" height="${h}" fill="${base}"/><rect width="${w}" height="${h}" fill="url(#mesh)"/>`
});

/** IC package top with an optional pin-1 dot (SVG markup in a w × d box). */
const chipTopSvg = (w, d, dot) => `<svg viewBox="0 0 ${w} ${d}" preserveAspectRatio="none">` +
    `<rect width="${w}" height="${d}" rx="1.5" fill="#1a1b1d"/>` +
    `<rect width="${w}" height="${d}" rx="1.5" fill="none" stroke="rgba(255,255,255,0.06)"/>` +
    `${dot ? `<circle cx="${dot.x}" cy="${dot.y}" r="1.6" fill="#0a0a0b"/>` : ''}</svg>`;

/** Top of an RJ11 housing, mouth at x = 0, D deep and Wd across, with a colour stripe at the back. */
const jackTopSvg = (D, Wd, color) => {
    const pins = [0, 1, 2, 3, 4, 5].map(i => {
        const cy = (Wd * 0.28) + (i * ((Wd * 0.44) / 5));
        return `<path d="M 6 ${cy} L ${(D * 0.6) - 2} ${cy} L ${D * 0.6} ${cy + 2}" fill="none" stroke="#b88f37" ` +
            'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            `<path d="M 6 ${cy - 0.4} L ${(D * 0.6) - 2} ${cy - 0.4}" stroke="#f5dc93" stroke-width="0.5" stroke-linecap="round"/>`;
    }).join('');
    return '<defs><linearGradient id="jt" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#2c2c2c"/><stop offset="100%" stop-color="#0c0c0c"/></linearGradient></defs>' +
        `<rect width="${D}" height="${Wd}" fill="url(#jt)"/>` +
        `<rect width="4" height="${Wd}" rx="2" fill="#2f2f2f"/>` +
        `<rect x="${D * 0.7}" y="${Wd * 0.12}" width="${D * 0.12}" height="${Wd * 0.76}" rx="1" fill="#151515" stroke="#2c2c2c" stroke-width="0.6"/>` +
        `<rect x="${D - 4.5}" y="3" width="2.5" height="${Wd - 6}" rx="1.2" fill="${color}" opacity="0.9"/>` +
        `<line x1="5" y1="1.6" x2="${D - 6}" y2="1.6" stroke="#3a3a3a" stroke-width="1"/>` +
        `<line x1="5" y1="${Wd - 1.6}" x2="${D - 6}" y2="${Wd - 1.6}" stroke="#050505" stroke-width="1"/>` +
        `<rect x="4" y="${Wd * 0.2}" width="${D * 0.6}" height="${Wd * 0.6}" rx="1.5" fill="#050505" stroke="#1f1f1f" stroke-width="0.8"/>` +
        pins;
};

/** The mouth the plug goes into, cropped to `span` of the Wd-wide face, H tall. */
const jackMouthSvg = (Wd, H, span) => {
    const pins = [0, 1, 2, 3, 4, 5].map(i => {
        const x = (Wd * 0.29) + (i * ((Wd * 0.42) / 5));
        return `<path d="M${x},${H * 0.17} L${x},${H * 0.3} L${x + 0.6},${H * 0.4}" fill="none" stroke="#c99d3e" ` +
            'stroke-width="0.8" stroke-linecap="round"/>';
    }).join('');
    return `<rect width="${span}" height="${H}" fill="#161616"/>` +
        `<g transform="translate(${-(Wd - span) / 2}, 0)">` +
        `<rect x="${Wd * 0.18}" y="${H * 0.16}" width="${Wd * 0.64}" height="${H * 0.6}" rx="1.2" fill="#030303"/>` +
        `<rect x="${Wd * 0.4}" y="${H * 0.74}" width="${Wd * 0.2}" height="${H * 0.14}" fill="#030303"/>` +
        `<line x1="0" y1="0.5" x2="${Wd}" y2="0.5" stroke="#3a3a3a" stroke-width="1"/>${pins}</g>`;
};

// ---- Parts ------------------------------------------------------------------

/** Unshared copy of a cached material, freed with the mesh that owns it. */
const ownCopy = m => {
    const copy = m.clone();
    copy.userData.shared = false;
    return copy;
};

/**
 * RJ11 housing in its own frame: mouth on the west face, D deep (x) by Wd across (y), centred on
 * the origin. Board jacks and module sockets are the same part.
 */
const buildJack = (kit, {color, D = JACK.w, Wd = JACK.h}) => {
    const group = new Group();
    const top = kit.tex.svg(`jack-top:${color}:${D}:${Wd}`, D, Wd, jackTopSvg(D, Wd, color), {ppu: 8, base: '#161616'});
    const housing = kit.slab({
        x: -D / 2,
        y: -Wd / 2,
        w: D,
        d: Wd,
        h: JACK_H,
        r: JACK_R,
        top: {map: top, rough: 0.5},
        side: {color: '#141414', rough: 0.5}
    });
    group.add(housing);

    const span = Wd * 0.84;
    const mouth = kit.tex.svg(`jack-mouth:${Wd}`, span, JACK_H, jackMouthSvg(Wd, JACK_H, span), {ppu: 8, base: '#161616'});
    group.add(kit.sideDecal({
        face: 'w',
        x: -D / 2,
        y: -Wd / 2,
        w: D,
        d: Wd,
        z: 0,
        h: JACK_H,
        span,
        material: {map: mouth, rough: 0.5}
    }));
    group.userData.housing = housing;
    return group;
};

const resistor = (kit, g, x, y) => g.add(kit.box({
    x,
    y,
    w: 10,
    d: 5,
    h: 2.2,
    z: TOP,
    color: '#121212',
    faces: {t: {map: passiveTexture(kit, 'R', true), rough: 0.45}}
}));

const chip = (kit, g, x, y, w, d, h = 2.4) => g.add(kit.box({
    x,
    y,
    w,
    d,
    h,
    z: TOP,
    color: {color: '#151617', rough: 0.45},
    faces: {t: {map: kit.tex.svg(`chip:${w}:${d}`, w, d, chipTopSvg(w, d), {ppu: 8, base: '#1a1b1d'}), rough: 0.45}}
}));

/** Gull-wing legs along the north and/or south side of a package (x, y is the body's corner). */
const legs = (kit, g, {x, y, w, d, north = 0, south = 0, size = [1.1, 1.8]}) => {
    const [lw, ld] = size;
    [[north, y - ld + 0.2], [south, y + d - 0.2]].forEach(([n, ly]) => {
        for (let i = 0; i < n; i++) {
            const lx = x + ((w / n) * (i + 0.5)) - (lw / 2);
            g.add(kit.box({x: lx, y: ly, w: lw, d: ld, h: 0.45, z: TOP, color: METAL, shadow: false}));
        }
    });
};

/** SOIC IC (e.g. SOIC-8 with pins: 4 per side), pin-1 dot at the north-west corner. */
const soic = (kit, g, {x, y, w = 10, d = 8, pins = 4, h = 1.8}) => {
    legs(kit, g, {x, y, w, d, north: pins, south: pins});
    g.add(kit.box({
        x, y, w, d, h, z: TOP + 0.3,
        color: {color: '#151617', rough: 0.45},
        faces: {t: {map: kit.tex.svg(`soic:${w}:${d}`, w, d, chipTopSvg(w, d, {x: 1.8, y: 1.8}), {ppu: 10, base: '#1a1b1d'}), rough: 0.45}}
    }));
};

/** SOT-23 (three legs: two south, one north), e.g. a small regulator. */
const sot23 = (kit, g, {x, y, w = 6, d = 3.4}) => {
    legs(kit, g, {x, y, w, d, south: 2, size: [1, 1.5]});
    legs(kit, g, {x: x + (w / 3), y, w: w / 3, d, north: 1, size: [1, 1.5]});
    g.add(kit.box({x, y, w, d, h: 1.3, z: TOP + 0.2, color: {color: '#151617', rough: 0.45}}));
};

/** Small SMD capacitor (tan body, metal ends). */
const capacitor = (kit, g, x, y, horizontal = true) => g.add(kit.box({
    x,
    y,
    w: horizontal ? 6 : 3.4,
    d: horizontal ? 3.4 : 6,
    h: 1.8,
    z: TOP,
    color: '#8a6641',
    faces: {t: {map: passiveTexture(kit, 'C', horizontal), rough: 0.45}}
}));

/**
 * Cylinder lying along +x from x0 to x1 (world units), centred on (cy, cz).
 * `top` is the cap facing +x, `bottom` the cap facing -x.
 */
const axial = (kit, {x0, x1, cy, cz, r, side, top, bottom, seg = 40}) => {
    const mesh = kit.cylinder({cx: 0, cy: 0, r, z0: 0, z1: x1 - x0, side, top, bottom, seg});
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, -cy, cz);
    return mesh;
};

/** Fine lengthwise ridges for knurled knobs and threaded bushings (around × along, in units). */
const ridgeTexture = (kit, key, around, along, pitch, base, ridge) => kit.tex.canvas(`ridge:${key}`, around, along, (ctx, cw, ch) => {
    const s = cw / around;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = ridge;
    for (let x = 0; x < around; x += pitch) {
        ctx.fillRect(x * s, 0, pitch * 0.45 * s, ch);
    }
}, {
    ppu: 8,
    svg: `<defs><pattern id="ridge" width="${pitch}" height="${along}" patternUnits="userSpaceOnUse">` +
        `<rect width="${pitch * 0.45}" height="${along}" fill="${ridge}"/></pattern></defs>` +
        `<rect width="${around}" height="${along}" fill="${base}"/><rect width="${around}" height="${along}" fill="url(#ridge)"/>`
});

const TRIMMER_SVG = '<rect width="10" height="10" fill="#2f6fd6"/>' +
    '<circle cx="5" cy="5" r="3.4" fill="#d8b25a" stroke="#9c7a2c" stroke-width="0.4"/>' +
    '<path d="M3 5 H7 M5 3 V7" stroke="#7a5a1c" stroke-width="0.8"/>';

const trimmer = (kit, g, x, y) => g.add(kit.box({
    x,
    y,
    w: 10,
    d: 10,
    h: 6,
    z: TOP,
    color: {color: '#2a62bf', rough: 0.45},
    faces: {t: {map: kit.tex.svg('trimmer', 10, 10, TRIMMER_SVG, {ppu: 12, base: '#2f6fd6'}), rough: 0.4}}
}));

const smdLed = (kit, g, x, y, color) => g.add(kit.box({
    x,
    y,
    w: 4,
    d: 3,
    h: 1.2,
    z: TOP,
    color: {color: '#e8e5dc', rough: 0.4},
    faces: {t: kit.basic({color})}
}));

const crystal = (kit, g, x, y, w, d) => g.add(kit.slab({
    x,
    y,
    w,
    d,
    h: 3,
    z: TOP,
    r: d / 2,
    top: {color: '#d9dbdd', rough: 0.25, metal: 0.9},
    side: {color: '#a9acaf', rough: 0.3, metal: 0.9}
}));

/** Metal can with a mesh top and a perforated wall. */
const meshCan = (kit, g, {key, cx, cy, r, z0, z1, pitch, topBase, topDot}) => {
    const h = z1 - z0;
    const circ = Math.PI * 2 * r;
    g.add(kit.cylinder({
        cx,
        cy,
        r,
        z0,
        z1,
        seg: 40,
        side: {map: meshTexture(kit, `${key}-wall`, circ, h, pitch, '#c3c6c9', '#6d7174'), rough: 0.35, metal: 0.8},
        top: {map: meshTexture(kit, `${key}-top`, r * 2, r * 2, pitch, topBase, topDot), rough: 0.5, metal: 0.4}
    }));
};

export {
    TOP,
    BLACK,
    METAL,
    glowTexture,
    glowDecal,
    passiveTexture,
    meshTexture,
    chipTopSvg,
    jackTopSvg,
    jackMouthSvg,
    ownCopy,
    buildJack,
    resistor,
    chip,
    soic,
    sot23,
    axial,
    ridgeTexture,
    capacitor,
    trimmer,
    smdLed,
    crystal,
    meshCan
};
