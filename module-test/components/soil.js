import {TOP, axial, passiveTexture, soic, sot23} from '../lib/parts.js';

/*
 * Capacitive soil moisture sensor v1.2 on the purple house PCB: RJ11 at the head, the 555
 * oscillator circuit, the white insertion line, then the probe with its capacitive sensing
 * trace (a U-shaped electrode and centre finger under the solder mask) tapering to a point.
 */
const W = 190;
const H = 44;
const LINE_X = 64;
const TIP = 176;
const SILK = '#f4f4f0';

/** Corner arc as SVG-style points (angles in degrees, y down). */
const arc = (cx, cy, r, a0, a1, n = 5) => Array.from({length: n + 1}, (_, i) => {
    const a = (a0 + (((a1 - a0) * i) / n)) * (Math.PI / 180);
    return [cx + (r * Math.cos(a)), cy + (r * Math.sin(a))];
});

/** Board outline: rounded head at the socket end, long probe tapering to a blunt point. */
const OUTLINE = [
    ...arc(3, 3, 3, 180, 270),
    [TIP, 0],
    [W, (H / 2) - 1.5],
    [W, (H / 2) + 1.5],
    [TIP, H],
    ...arc(3, H - 3, 3, 90, 180)
];

/** Two small SMD passives per row: [ref, kind, x, y, label side]. */
const PASSIVES = [
    ['C5', 'C', 31, 4, 'e'], ['C6', 'C', 31, 9, 'e'], ['R3', 'R', 31, 33, 'e'], ['R4', 'R', 31, 38, 'e'],
    ['R2', 'R', 44, 33, 'n'],
    ['C1', 'C', 55, 4, 'w'], ['C2', 'C', 55, 9, 'w'], ['R1', 'R', 55, 16, 'w'], ['C3', 'C', 55, 31, 'w'], ['C4', 'C', 55, 37, 'w']
];
const PART = {w: 4, d: 2};
const D1 = {x: 55, y: 22, w: 4.4};

const silkText = (t, x, y, anchor = 'middle', size = 2) => (
    `<text x="${x}" y="${y}" fill="${SILK}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" ` +
    `text-anchor="${anchor}" dominant-baseline="middle">${t}</text>`
);

/** The capacitive sensing electrode: copper under purple mask shows as a raised, lighter band. */
const electrode = (d, width) => `<path d="${d}" fill="none" stroke="#7a46b8" stroke-width="${width + 0.9}" ` +
    'stroke-linecap="round" stroke-linejoin="round"/>' +
    `<path d="${d}" fill="none" stroke="#60309a" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

const SILK_SVG = (() => {
    let s = '';
    // ground pour edge around the probe, then the U electrode and its centre finger
    s += `<path d="M ${LINE_X + 3} 2.2 H ${TIP - 1} L ${W - 3} ${H / 2} L ${TIP - 1} ${H - 2.2} H ${LINE_X + 3}" ` +
        'fill="none" stroke="#6a38a8" stroke-width="0.8"/>';
    s += electrode(`M ${LINE_X + 6} 9 H 158 A 13 13 0 0 1 158 35 H ${LINE_X + 6}`, 5);
    s += electrode(`M ${LINE_X + 10} 22 H 152`, 3.2);
    // insertion line
    s += `<line x1="${LINE_X}" y1="1" x2="${LINE_X}" y2="${H - 1}" stroke="${SILK}" stroke-width="1"/>`;
    // head: traces, part outlines and reference designators
    s += '<path d="M 28 16 H 41 M 28 22 H 36 L 40 20 M 28 28 H 41 M 51 21 H 55 M 46 8 V 17 M 46 25 V 33" ' +
        'stroke="#6531a3" stroke-width="0.9" fill="none" stroke-linecap="round"/>';
    PASSIVES.forEach(([ref, , x, y, side]) => {
        s += `<rect x="${x - 0.7}" y="${y - 0.7}" width="${PART.w + 1.4}" height="${PART.d + 1.4}" rx="0.4" fill="none" ` +
            `stroke="${SILK}" stroke-width="0.35"/>`;
        if (side === 'e') {
            s += silkText(ref, x + PART.w + 1.3, y + (PART.d / 2), 'start');
        } else if (side === 'w') {
            s += silkText(ref, x - 1.3, y + (PART.d / 2), 'end');
        } else {
            s += silkText(ref, x + (PART.w / 2), y - 2.2);
        }
    });
    s += `<rect x="${D1.x - 0.7}" y="${D1.y - 1.9}" width="${D1.w + 1.4}" height="3.8" rx="0.4" fill="none" stroke="${SILK}" stroke-width="0.35"/>`;
    s += silkText('D1', D1.x - 1.3, D1.y, 'end');
    s += silkText('U2', 46, 2.2) + silkText('U1', 39.5, 15.5, 'end');
    [[62, 6], [62, 38], [36, 24]].forEach(([x, y]) => {
        s += `<circle cx="${x}" cy="${y}" r="0.9" fill="#d4b15e"/>`;
    });
    return s;
})();

/**
 * Capacitive soil moisture sensor v1.2: socket at the head, TLC555 timer and regulator,
 * the capacitive sensing trace along the probe, printed title and the white insertion line.
 */
export default {
    id: 'soil',
    name: 'Capacitive Soil Moisture',
    category: 'sensor',
    defaultPort: 'A2',
    spec: {
        w: W,
        h: H,
        jackY: H / 2,
        label: 'Capacitive Soil\nMoisture Sensor v1.2',
        labelAt: [116, 22],
        labelSize: 7.6,
        outline: OUTLINE,
        holes: [],
        silk: SILK_SVG
    },
    build (kit, g) {
        soic(kit, g, {x: 41, y: 17, w: 10, d: 8});
        sot23(kit, g, {x: 43, y: 4.2});
        PASSIVES.forEach(([, kind, x, y]) => g.add(kit.box({
            x,
            y,
            w: PART.w,
            d: PART.d,
            h: kind === 'C' ? 1.4 : 1.1,
            z: TOP,
            color: kind === 'C' ? '#8a6641' : '#121212',
            faces: {t: {map: passiveTexture(kit, kind, true), rough: 0.45}}
        })));
        // D1: orange glass MiniMELF diode with its cathode band
        g.add(axial(kit, {x0: D1.x, x1: D1.x + D1.w, cy: D1.y, cz: TOP + 1.1, r: 1.1, seg: 16, side: {color: '#c8642a', rough: 0.2, opacity: 0.92}}));
        g.add(axial(kit, {x0: D1.x + 0.6, x1: D1.x + 1.3, cy: D1.y, cz: TOP + 1.1, r: 1.15, seg: 16, side: {color: '#1a1a1a', rough: 0.4}}));
    }
};
