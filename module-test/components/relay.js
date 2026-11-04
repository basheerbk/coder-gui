import {TOP, sot23} from '../lib/parts.js';
import {screwTerminal, smd, text} from '../lib/breakout.js';

/*
 * 1-channel 5 V relay (active-high) built straight onto the purple RJ11 carrier: the blue relay
 * cube, NO / COM / NC screw terminal on the far edge, driver transistor, flyback diode, resistors
 * and the PWR / IN LEDs.
 */
const W = 140;
const H = 58;
const CY = 26;
const CUBE = {x: 51, y: CY - 18.5, w: 46, d: 37, h: 37};
const TERM = {x: 104, y: CY - 18};

const CUBE_SVG = '<rect width="46" height="37" fill="#1f5fc4"/>' +
    '<g fill="#e9f0fb" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">' +
    '<text x="23" y="8" font-size="3.6" font-weight="700">SRD-05VDC-SL-C</text>' +
    '<text x="23" y="15" font-size="2.6">10A 250VAC  10A 125VAC</text>' +
    '<text x="23" y="20" font-size="2.6">10A 30VDC  10A 28VDC</text>' +
    '<rect x="15" y="25" width="16" height="7" fill="none" stroke="#e9f0fb" stroke-width="0.5"/>' +
    '<text x="23" y="30.2" font-size="2.8">5VDC</text></g>';

const outline = (x, y, w, d) => `<rect x="${x - 0.6}" y="${y - 0.6}" width="${w + 1.2}" height="${d + 1.2}" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>`;

const SILK = [
    // VCC, IN and GND from the socket to the driver and the coil
    `<path d="M 26 ${CY - 3} H 31 V 6 H ${CUBE.x + 6}" stroke="#6531a3" stroke-width="1.2" fill="none"/>`,
    `<path d="M 26 ${CY} H 37" stroke="#6531a3" stroke-width="1" fill="none"/>`,
    `<path d="M 26 ${CY + 3} H 31 V ${H - 8} H ${CUBE.x + 10}" stroke="#6531a3" stroke-width="1.2" fill="none"/>`,
    // contacts out to the terminal
    `<path d="M ${CUBE.x + CUBE.w} ${CY - 12} H ${TERM.x} M ${CUBE.x + CUBE.w} ${CY} H ${TERM.x} M ${CUBE.x + CUBE.w} ${CY + 12} H ${TERM.x}" stroke="#6531a3" stroke-width="2.4" fill="none"/>`,
    outline(CUBE.x, CUBE.y, CUBE.w, CUBE.d),
    outline(36, 8, 4.4, 2.4), outline(36, CY + 14, 4.4, 2.4),
    text('PWR', 38.2, 5.4, {size: 2}), text('IN', 38.2, CY + 20.4, {size: 2}),
    text('VCC', 34.4, CY - 6, {size: 1.9}), text('GND', 34.4, CY + 7.4, {size: 1.9}),
    text('NO', TERM.x + 20.4, CY - 12, {size: 2.4, anchor: 'start', weight: 700}), text('COM', TERM.x + 20.4, CY, {size: 2.4, anchor: 'start', weight: 700}),
    text('NC', TERM.x + 20.4, CY + 12, {size: 2.4, anchor: 'start', weight: 700}),
    text('Q1', 46, CY - 5, {size: 1.9}), text('D1', 46, CY + 9.4, {size: 1.9})
].join('');

export default {
    id: 'relay',
    name: 'Relay 1-Channel',
    category: 'output',
    defaultPort: 'J0',
    spec: {
        w: W,
        h: H,
        jackY: CY,
        label: 'RELAY 5V',
        labelAt: [CUBE.x + (CUBE.w / 2), H - 3.8],
        labelSize: 3.4,
        holes: [[6, H - 5], [W - 6, H - 5]],
        silk: SILK
    },
    build (kit, g) {
        const led = (x, y, color) => g.add(kit.box({x, y, w: 4.4, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color})}}));
        led(36, 8, '#ff3030');
        led(36, CY + 14, '#30ff60');
        smd(kit, g, 36, 13);
        smd(kit, g, 36, CY + 8.4);
        smd(kit, g, 40.4, CY - 1.1, 'R', true);
        sot23(kit, g, {x: 43.4, y: CY - 3});
        // 1N4148 flyback diode with its cathode band
        g.add(kit.box({x: 42.6, y: CY + 4, w: 7, d: 2.6, h: 2.2, z: TOP, color: {color: '#c46a2a', rough: 0.3}}));
        g.add(kit.box({x: 48, y: CY + 4, w: 0.9, d: 2.62, h: 2.22, z: TOP, color: {color: '#1a1a1a', rough: 0.4}}));
        g.add(kit.box({
            x: CUBE.x,
            y: CUBE.y,
            w: CUBE.w,
            d: CUBE.d,
            h: CUBE.h,
            z: TOP,
            color: {color: '#1d58b8', rough: 0.35},
            faces: {t: {map: kit.tex.svg('relay-cube', 46, 37, CUBE_SVG, {ppu: 10, base: '#1f5fc4'}), rough: 0.35}}
        }));
        screwTerminal(kit, g, {x: TERM.x, y: TERM.y, n: 3, pitch: 12, open: 'e'});
    }
};
