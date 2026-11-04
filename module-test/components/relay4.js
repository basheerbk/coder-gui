import {JACK, PCB_H} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {TOP, buildJack, sot23} from '../lib/parts.js';
import {screwTerminal, smd, text} from '../lib/breakout.js';

/*
 * 4-channel 5 V relay board built straight onto one purple carrier: two RJ11 jacks (relays 1–2 and
 * 3–4) and a DC barrel jack for the relay supply along the jack edge, then per channel a driver
 * (transistor, flyback diode, resistors, IN LED), the blue relay cube and its NO / COM / NC terminal.
 */
const W = 156;
const H = 196;
const ROW = 46;
const Y0 = 10;
const CH = [0, 1, 2, 3].map(i => Y0 + (i * ROW));
const CUBE = {x: 70, w: 46, d: 37, h: 37};
const TERM_X = 126;
const JACK2_Y = 100;
const DC = {x: -2, y: 150, w: 34, d: 22, h: 26};
const SOCKET_COLOR = '#8d9093';

const CUBE_SVG = '<rect width="46" height="37" fill="#1f5fc4"/>' +
    '<g fill="#e9f0fb" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">' +
    '<text x="23" y="8" font-size="3.6" font-weight="700">SRD-05VDC-SL-C</text>' +
    '<text x="23" y="15" font-size="2.6">10A 250VAC  10A 125VAC</text>' +
    '<text x="23" y="20" font-size="2.6">10A 30VDC  10A 28VDC</text>' +
    '<rect x="15" y="25" width="16" height="7" fill="none" stroke="#e9f0fb" stroke-width="0.5"/>' +
    '<text x="23" y="30.2" font-size="2.8">5VDC</text></g>';

/** DC barrel jack mouth: dark ring with the centre pin. */
const DC_FACE = '<rect width="22" height="26" fill="#151517"/>' +
    '<circle cx="11" cy="12" r="7" fill="#050505" stroke="#2a2a2c" stroke-width="0.8"/>' +
    '<circle cx="11" cy="12" r="1.6" fill="#c9ccce"/>';

const outline = (x, y, w, d) => `<rect x="${x - 0.6}" y="${y - 0.6}" width="${w + 1.2}" height="${d + 1.2}" rx="0.4" fill="none" stroke="#f2f4f6" stroke-width="0.35"/>`;

const SILK = (() => {
    let s = '';
    CH.forEach((y, i) => {
        const cy = y + (CUBE.d / 2);
        const jackY = i < 2 ? 40 : JACK2_Y;
        // signal from its jack, coil supply rail, contacts to the terminal
        s += `<path d="M 26 ${jackY + ((i % 2) ? 4 : -4)} H ${34 + (i * 1.4)} V ${cy} H 46" stroke="#6531a3" stroke-width="1" fill="none"/>`;
        s += `<path d="M ${CUBE.x + CUBE.w} ${cy - 12} H ${TERM_X} M ${CUBE.x + CUBE.w} ${cy} H ${TERM_X} M ${CUBE.x + CUBE.w} ${cy + 12} H ${TERM_X}" stroke="#6531a3" stroke-width="2.2" fill="none"/>`;
        s += outline(CUBE.x, y, CUBE.w, CUBE.d) + outline(48, y + 2, 4.4, 2.4);
        s += text(`IN${i + 1}`, 50.2, y - 0.6, {size: 1.9}) + text(`K${i + 1}`, CUBE.x + 2, y - 2.4, {size: 2, anchor: 'start', weight: 700});
        s += text('NO', TERM_X + 20.4, cy - 12, {size: 2.2, anchor: 'start', weight: 700}) +
            text('COM', TERM_X + 20.4, cy, {size: 2.2, anchor: 'start', weight: 700}) +
            text('NC', TERM_X + 20.4, cy + 12, {size: 2.2, anchor: 'start', weight: 700});
    });
    s += `<path d="M 30 ${DC.y + 11} H 62 V ${Y0 - 4} H ${CUBE.x + 4}" stroke="#6531a3" stroke-width="2.4" fill="none"/>`;
    s += text('IN1 IN2', 15, 62, {size: 2.4, weight: 700}) + text('IN3 IN4', 15, JACK2_Y + 22, {size: 2.4, weight: 700});
    s += text('DC 5V', 15, DC.y + DC.d + 5, {size: 2.6, weight: 700}) + outline(40, DC.y + 26, 4.4, 2.4) + text('PWR', 42.2, DC.y + 32, {size: 1.9});
    return s;
})();

export default {
    id: 'relay4',
    name: '4-Channel Relay',
    category: 'output',
    defaultPort: 'J0',
    spec: {
        w: W,
        h: H,
        jackY: 40,
        label: '4-CH RELAY',
        labelAt: [CUBE.x + (CUBE.w / 2), H - 4],
        labelSize: 3.6,
        holes: [[W - 6, 6], [W - 6, H - 6], [6, H - 6]],
        silk: SILK
    },
    build (kit, g) {
        // second RJ11 jack and the DC barrel jack on the jack edge
        const jack2 = buildJack(kit, {color: SOCKET_COLOR});
        jack2.position.set(...at(-2 + (JACK.w / 2), JACK2_Y), PCB_H);
        g.add(jack2);
        g.add(kit.box({x: DC.x, y: DC.y, w: DC.w, d: DC.d, h: DC.h, z: TOP, color: {color: '#151517', rough: 0.45}}));
        g.add(kit.sideDecal({face: 'w', x: DC.x, y: DC.y, w: DC.w, d: DC.d, z: TOP, h: DC.h, material: {map: kit.tex.svg('dc-jack-face', 22, 26, DC_FACE, {ppu: 10, base: '#151517'}), rough: 0.4}}));
        g.add(kit.box({x: 40, y: DC.y + 26, w: 4.4, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color: '#ff3030'})}}));

        CH.forEach(y => {
            // driver: IN LED, resistors, transistor, flyback diode
            g.add(kit.box({x: 48, y: y + 2, w: 4.4, d: 2.4, h: 1.2, z: TOP, color: {color: '#e8e5dc', rough: 0.4}, faces: {t: kit.basic({color: '#30ff60'})}}));
            smd(kit, g, 48, y + 7);
            smd(kit, g, 48, y + 12);
            sot23(kit, g, {x: 56, y: y + 15});
            g.add(kit.box({x: 55, y: y + 23, w: 7, d: 2.6, h: 2.2, z: TOP, color: {color: '#c46a2a', rough: 0.3}}));
            g.add(kit.box({x: 60.4, y: y + 23, w: 0.9, d: 2.62, h: 2.22, z: TOP, color: {color: '#1a1a1a', rough: 0.4}}));
            // relay cube and its terminal
            g.add(kit.box({
                x: CUBE.x,
                y,
                w: CUBE.w,
                d: CUBE.d,
                h: CUBE.h,
                z: TOP,
                color: {color: '#1d58b8', rough: 0.35},
                faces: {t: {map: kit.tex.svg('relay-cube', 46, 37, CUBE_SVG, {ppu: 10, base: '#1f5fc4'}), rough: 0.35}}
            }));
            screwTerminal(kit, g, {x: TERM_X, y: y + (CUBE.d / 2) - 18, n: 3, pitch: 12, open: 'e'});
        });
    }
};
