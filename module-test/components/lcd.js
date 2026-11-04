import {TOP} from '../lib/parts.js';
import {PCB, holeSvg, text} from '../lib/breakout.js';

/*
 * LCD 16×2 with I²C backpack (PCF8574, address 0x27): the green 80 × 36 mm LCD board on four
 * brass standoffs right on the purple RJ11 carrier. The backpack underneath plugs straight down
 * into a 4-pin socket on the carrier — no wires.
 */
const LX = 34;
const LY = 4;
const LW = 192;
const LD = 86;
const LIFT = 28;
const W = LX + LW + 6;
const H = LY + LD + 10;
const NAMES = ['GND', 'VCC', 'SDA', 'SCL'];
const HDR = {x: LX + 5, y: LY + 13};
const PITCH = 6.1;
const HOLES = [[6, 6], [LW - 6, 6], [6, LD - 6], [LW - 6, LD - 6]];

const LCD_PCB = `<rect width="${LW}" height="${LD}" fill="${PCB.green[0]}"/>` +
    HOLES.map(([x, y]) => holeSvg(x, y, 4.2)).join('') +
    Array.from({length: 16}, (_, i) => holeSvg(19 + (i * 6.1), 4.6, 1.8)).join('') +
    text('1', 19, 9.6, {size: 2}) + text('16', 110.5, 9.6, {size: 2});

/** 16 × 2 characters of 5 × 8 dots, white on the blue backlight. */
const SCREEN = (() => {
    const VW = 155;
    const VH = 35;
    const lines = ['   TinkerBit    ', 'Temp: 28.5 C    '];
    let s = `<rect width="${VW}" height="${VH}" fill="#1d4fd6"/>`;
    const cw = 8.6;
    const ch = 13.4;
    const x0 = (VW - (16 * cw)) / 2;
    lines.forEach((line, r) => {
        for (let c = 0; c < 16; c++) {
            const x = x0 + (c * cw) + 0.4;
            const y = 3 + (r * (ch + 2.2));
            s += `<rect x="${x}" y="${y}" width="${cw - 0.8}" height="${ch}" fill="#2a5ee0"/>`;
        }
        s += `<text x="${x0 + 0.6}" y="${3 + (r * (ch + 2.2)) + 10.6}" fill="#f4f8ff" font-family="Consolas, 'Courier New', monospace" ` +
            `font-size="13.4" textLength="${16 * cw}" lengthAdjust="spacing" xml:space="preserve">${line}</text>`;
    });
    return s;
})();

export default {
    id: 'lcd',
    name: 'LCD 16×2 (I²C)',
    category: 'output',
    defaultPort: 'I2C',
    spec: {
        w: W,
        h: H,
        jackY: H / 2,
        label: 'LCD 16x2  I2C 0x27',
        labelAt: [LX + (LW / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, 6], [6, H - 6]],
        silk: NAMES.map((n, i) => {
            const y = HDR.y + 3 + (i * PITCH);
            return `<path d="M 26 ${(H / 2) + ((i - 1.5) * 2.3)} H 29 L ${HDR.x} ${y}" stroke="#6531a3" stroke-width="1.1" fill="none"/>` +
                holeSvg(HDR.x, y, 1.6, '#d4b15e');
        }).join('')
    },
    build (kit, g) {
        // standoffs and the LCD board
        HOLES.forEach(([u, v]) => g.add(kit.cylinder({cx: LX + u, cy: LY + v, r: 3.2, z0: TOP, z1: TOP + LIFT, seg: 6, side: {color: '#c9a34c', rough: 0.35, metal: 0.8}})));
        const z = TOP + LIFT;
        g.add(kit.slab({x: LX, y: LY, w: LW, d: LD, h: 1.6, z, r: 1.5, top: {map: kit.tex.svg('lcd-pcb', LW, LD, LCD_PCB, {ppu: 6, base: PCB.green[0]}), rough: 0.55}, side: {color: PCB.green[1]}}));
        // black bezel and the backlit glass
        const bx = LX + 11;
        const by = LY + 14;
        g.add(kit.box({x: bx, y: by, w: 170, d: 58, h: 7.2, z: z + 1.6, color: {color: '#121214', rough: 0.4, metal: 0.3}}));
        g.add(kit.box({
            x: bx + 7.5,
            y: by + 11.5,
            w: 155,
            d: 35,
            h: 0.4,
            z: z + 8.8,
            color: '#1d4fd6',
            faces: {t: kit.basic({map: kit.tex.svg('lcd-screen', 155, 35, SCREEN, {ppu: 8, base: '#1d4fd6'})})}
        }));
        // PCF8574 backpack under the left of the LCD, plugged straight down into the carrier's socket
        const pz = z - 12;
        g.add(kit.box({x: LX, y: LY + 2, w: 98, d: 46, h: 1.6, z: pz, color: {color: PCB.black[0], rough: 0.55}}));
        g.add(kit.box({x: LX + 34, y: LY + 14, w: 18, d: 10, h: 2.4, z: pz - 2.4, color: {color: '#151617', rough: 0.45}}));
        g.add(kit.box({x: LX + 62, y: LY + 30, w: 10, d: 10, h: 6, z: pz - 6, color: {color: '#2a62bf', rough: 0.45}}));
        g.add(kit.box({x: HDR.x - 3, y: HDR.y, w: 6, d: PITCH * 4, h: 9, z: TOP, color: {color: '#151515', rough: 0.5}}));
        g.add(kit.box({x: HDR.x - 3, y: HDR.y, w: 6, d: PITCH * 4, h: 2.6, z: pz - 2.6, color: {color: '#1d1d1d', rough: 0.5}}));
        NAMES.forEach((n, i) => g.add(kit.box({
            x: HDR.x - 0.7,
            y: HDR.y + 3 + (i * PITCH) - 0.7,
            w: 1.4,
            d: 1.4,
            h: pz - 2.6 - (TOP + 9),
            z: TOP + 9,
            color: {color: '#d6b25a', rough: 0.3, metal: 0.85}
        })));
    }
};
