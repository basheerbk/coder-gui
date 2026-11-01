import {BLACK, TOP, capacitor} from '../lib/parts.js';

/*
 * HC-SR04 ultrasonic sensor on a TinkerBit RJ11 carrier.
 * The real blue HC-SR04 board (45 × 20 mm, about 2.4 units per mm) stands upright, soldered
 * straight onto the purple carrier, transducers facing east, away from the RJ11 socket.
 */
const W = 92;
const H = 116;

// HC-SR04 board: vertical plane at x = HC.x, spanning y HC.y .. HC.y + HC.w, HC.h tall.
const HC = {x: 56, y: 4, w: 108, h: 48, t: 2};
const FRONT = HC.x + HC.t;
const SOCKET = {w: 6};
const Z_BOT = TOP;
const Z_TOP = Z_BOT + HC.h;
const CAN = {r: 19, len: 29, v: 24, u: [23, 85]};
const PITCH = 6.1;
const PIN_U = [0, 1, 2, 3].map(i => 54 + ((i - 1.5) * PITCH));
const PIN_NAMES = ['Vcc', 'Trig', 'Echo', 'Gnd'];

/** Face coordinates (u across from the left as seen from the front, v down from the top) to world y / z. */
const yOf = u => HC.y + HC.w - u;
const zOf = v => Z_TOP - v;

const HC_BLUE = '#1f5fa8';
const HC_EDGE = '#123d70';

const FRONT_SVG = `<rect width="${HC.w}" height="${HC.h}" fill="${HC_BLUE}"/>` +
    [[3.5, 3.5], [HC.w - 3.5, 3.5], [3.5, HC.h - 3.5], [HC.w - 3.5, HC.h - 3.5]].map(([x, y]) => (
        `<circle cx="${x}" cy="${y}" r="2.4" fill="#d9dbdd"/><circle cx="${x}" cy="${y}" r="1.3" fill="#0e2340"/>`
    )).join('') +
    CAN.u.map(u => `<circle cx="${u}" cy="${CAN.v}" r="${CAN.r + 1.2}" fill="#16467e"/>`).join('') +
    '<g fill="#f4f4f0" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">' +
    `<text x="47" y="21" font-size="4.2">T</text><text x="61" y="21" font-size="4.2">R</text>` +
    '<text x="54" y="30" font-size="5">HC-SR04</text>' +
    PIN_U.map((u, i) => `<text x="${u}" y="40" font-size="2.3" font-weight="400">${PIN_NAMES[i]}</text>`).join('') +
    '</g>';

const BACK_SVG = `<rect width="${HC.w}" height="${HC.h}" fill="${HC_BLUE}"/>` +
    '<path d="M10 40 H40 V30 M98 40 H68 V30 M30 12 H78" stroke="#2b6cb8" stroke-width="0.8" fill="none"/>' +
    PIN_U.map(u => `<circle cx="${HC.w - u}" cy="${HC.h - 3}" r="1.5" fill="#d6b25a"/>`).join('');

/** Woven gauze over the transducer mouth with a bright rolled rim. */
const faceTexture = kit => kit.tex.canvas('hcsr04-face', 2 * CAN.r, 2 * CAN.r, (ctx, cw, ch) => {
    const r = cw / 2;
    ctx.fillStyle = '#2a2c2f';
    ctx.fillRect(0, 0, cw, ch);
    const step = cw / 34;
    ctx.fillStyle = '#9ca1a6';
    for (let y = step / 2; y < ch; y += step) {
        for (let x = step / 2; x < cw; x += step) {
            ctx.fillRect(x - (step * 0.32), y - (step * 0.32), step * 0.64, step * 0.64);
        }
    }
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = '#dfe2e5';
    ctx.beginPath();
    ctx.arc(r, r, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
}, {
    ppu: 10,
    svg: (() => {
        const d = 2 * CAN.r;
        const step = d / 34;
        return `<defs><pattern id="gauze" width="${step}" height="${step}" patternUnits="userSpaceOnUse">` +
            `<rect x="${step * 0.18}" y="${step * 0.18}" width="${step * 0.64}" height="${step * 0.64}" fill="#9ca1a6"/></pattern></defs>` +
            `<rect width="${d}" height="${d}" fill="#2a2c2f"/><rect width="${d}" height="${d}" fill="url(#gauze)"/>` +
            `<circle cx="${CAN.r}" cy="${CAN.r}" r="${CAN.r * 0.92}" fill="none" stroke="#dfe2e5" stroke-width="${CAN.r * 0.16}"/>`;
    })()
});

/** Carrier: copper traces from the socket to the header and the silkscreen pin names. */
const SILK = PIN_U.map(u => {
    const y = yOf(u);
    return `<path d="M 26 ${58 + ((y - 58) * 0.45)} L 40 ${58 + ((y - 58) * 0.45)} L 48 ${y} H ${FRONT + 1}" ` +
        'fill="none" stroke="#6531a3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
}).join('') +
    PIN_U.map((u, i) => `<text x="${FRONT + SOCKET.w + 3}" y="${yOf(u)}" fill="#f4f4f0" font-family="Arial Narrow, sans-serif" ` +
        `font-size="3" dominant-baseline="middle">${PIN_NAMES[i].toUpperCase()}</text>`).join('');

/** A transducer: aluminium can lying along +x from the board's front face. */
const transducer = (kit, g, u) => {
    const can = kit.cylinder({
        cx: 0,
        cy: 0,
        r: CAN.r,
        z0: 0,
        z1: CAN.len,
        seg: 48,
        side: {color: '#cfd2d5', rough: 0.3, metal: 0.85},
        top: {map: faceTexture(kit), rough: 0.55, metal: 0.4}
    });
    can.rotation.y = Math.PI / 2;
    can.position.set(FRONT + (CAN.len / 2), -yOf(u), zOf(CAN.v));
    g.add(can);
};

/** HC-SR04 ultrasonic module soldered upright onto the RJ11 carrier. */
export default {
    id: 'ultra',
    name: 'HC-SR04 Ultrasonic',
    category: 'sensor',
    defaultPort: 'N01',
    spec: {
        w: W,
        h: H,
        jackY: H / 2,
        label: 'HC-SR04\nULTRASONIC',
        labelAt: [24, 100],
        labelSize: 4.6,
        holes: [[8, 8], [8, H - 8], [W - 6, 6], [W - 6, H - 6]],
        silk: SILK
    },
    build (kit, g) {
        capacitor(kit, g, 36, 84, false);

        // the HC-SR04 board, soldered straight onto the carrier
        const board = {x: HC.x, y: HC.y, w: HC.t, d: HC.w, z: Z_BOT, h: HC.h};
        g.add(kit.box({...board, color: {color: HC_EDGE, rough: 0.6}}));
        g.add(kit.sideDecal({...board, face: 'e', material: {map: kit.tex.svg('hcsr04-front', HC.w, HC.h, FRONT_SVG, {ppu: 8, base: HC_BLUE}), rough: 0.55}}));
        g.add(kit.sideDecal({...board, face: 'w', material: {map: kit.tex.svg('hcsr04-back', HC.w, HC.h, BACK_SVG, {ppu: 6, base: HC_BLUE}), rough: 0.55}}));

        // chips on the back of the HC-SR04
        [[24, 14], [72, 14], [48, 8]].forEach(([u, v]) => g.add(kit.box({
            x: HC.x - 2.2,
            y: yOf(HC.w - u) - 6,
            w: 2.2,
            d: 12,
            h: 8,
            z: zOf(v + 8),
            color: BLACK
        })));

        CAN.u.forEach(u => transducer(kit, g, u));

        // HC-49S crystal between the cans
        g.add(kit.box({
            x: FRONT,
            y: yOf(54) - 5.5,
            w: 3.5,
            d: 11,
            h: 4.5,
            z: zOf(10),
            color: {color: '#d9dbdd', rough: 0.25, metal: 0.9}
        }));
    }
};
