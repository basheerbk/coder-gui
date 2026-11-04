import {TOP, sot23} from '../lib/parts.js';
import {PCB, boardSvg, carrierTraces, ledSmd, pinColumn, rightAngleHeader, smd, stack, text} from '../lib/breakout.js';

/*
 * MPU6050 motion sensor on the GY-521 board (21 × 16 mm, 8-pin header along the long edge),
 * right-angle header facing the RJ11 socket, its pins bent down into the carrier.
 */
const MX = 40;
const MY = 5;
const w = 38;
const d = 50;
const pins = pinColumn(8, 3, d / 2);
const names = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'];
const DROP_X = MX - 5;
const W = MX + w + 6;
const H = MY + d + 12;

const AXES = '<g stroke="#f2f4f6" stroke-width="0.6" fill="#f2f4f6">' +
    '<path d="M 18 45 H 25" fill="none"/><path d="M 25 43.8 L 27 45 L 25 46.2 Z"/>' +
    '<path d="M 18 45 V 38" fill="none"/><path d="M 16.8 38 L 18 36 L 19.2 38 Z"/></g>' +
    text('X', 27.4, 42.2, {size: 2.2}) + text('Y', 21, 37.4, {size: 2.2});

const svg = boardSvg({
    w,
    d,
    color: PCB.blue[0],
    holes: [[w - 5, 5, 3.2], [w - 5, d - 5, 3.2]],
    pins,
    extra: text('GY-521', 22, 5.2, {size: 3, weight: 700}) + AXES +
        names.map((n, i) => text(n, 8.6, pins[i].v, {size: 1.8, anchor: 'start'})).join('')
});

const CHIP = '<rect width="9.6" height="9.6" fill="#1a1b1d"/><circle cx="1.6" cy="1.6" r="0.7" fill="#0a0a0b"/>' +
    '<text x="4.8" y="5.6" fill="#6c6f75" font-family="Arial, sans-serif" font-size="1.7" text-anchor="middle">MPU-6050</text>';

export default {
    id: 'mpu6050',
    name: 'MPU6050 Motion Sensor',
    category: 'sensor',
    defaultPort: 'I2C',
    spec: {
        w: W,
        h: H,
        jackY: MY + (d / 2),
        label: 'MPU6050',
        labelAt: [MX + (w / 2), H - 5],
        labelSize: 3.6,
        holes: [[6, H - 6]],
        silk: carrierTraces(pins.map(p => [DROP_X, MY + p.v]), MY + (d / 2), {spread: 1.8, width: 0.9})
    },
    build (kit, g) {
        const m = stack(kit, g, {x: MX, y: MY, w, d, key: 'mpu6050-ra-module', svg, color: PCB.blue});
        rightAngleHeader(kit, g, m, {mx: MX, my: MY, vs: pins.map(p => p.v), dropX: DROP_X});
        m.add(kit.box({
            x: 20,
            y: 13,
            w: 9.6,
            d: 9.6,
            h: 1.4,
            z: TOP,
            color: {color: '#18191b', rough: 0.45},
            faces: {t: {map: kit.tex.svg('mpu6050-chip', 9.6, 9.6, CHIP, {ppu: 14, base: '#1a1b1d'}), rough: 0.45}}
        }));
        sot23(kit, m, {x: 26, y: 25});
        ledSmd(kit, m, 15.6, 26, '#ff3030');
        smd(kit, m, 15.6, 30.6);
        smd(kit, m, 27.6, 31, 'C', true);
        smd(kit, m, 31.4, 31, 'C', true);
        smd(kit, m, 31, 13, 'R', true);
    }
};

