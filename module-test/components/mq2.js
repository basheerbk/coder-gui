import {Group} from 'three';

import {PCB_H} from '../lib/board-data.js';
import {at} from '../lib/kit.js';
import {BLACK, TOP, capacitor, meshCan, resistor, smdLed, soic} from '../lib/parts.js';

/*
 * Generic MQ-2 gas sensor module (blue, 32 × 22 mm, about 2.4 units per mm) stacked on its
 * 4-pin header on the purple RJ11 carrier. The module's own parts are built in a sub-group
 * whose TOP is the module's surface, so the shared part helpers work unchanged.
 */
const W = 120;
const H = 70;

const MOD = {x: 36, y: 12, w: 77, d: 53};
const SPACER_H = 6;
const PITCH = 6.1;
const PIN_V = [0, 1, 2, 3].map(i => (MOD.d / 2) + ((i - 1.5) * PITCH));
const PIN_NAMES = ['VCC', 'GND', 'DO', 'AO'];
const SENSOR = {u: 52, v: MOD.d / 2, base: 23, mesh: 19, baseH: 8, meshH: 22};

const BLUE = '#1f5fa8';
const SILK = '#f4f4f0';

/** Module top: blue mask, white silkscreen, two mounting holes and the header pads. */
const MODULE_TOP = `<rect width="${MOD.w}" height="${MOD.d}" fill="${BLUE}"/>` +
    [[3.5, 4], [3.5, MOD.d - 4]].map(([x, y]) => (
        `<circle cx="${x}" cy="${y}" r="2.4" fill="#d9dbdd"/><circle cx="${x}" cy="${y}" r="1.3" fill="#0e2340"/>`
    )).join('') +
    PIN_V.map(v => `<rect x="1" y="${v - 2}" width="4" height="4" rx="0.8" fill="#d9dbdd"/>`).join('') +
    `<circle cx="${SENSOR.u}" cy="${SENSOR.v}" r="${SENSOR.base + 1.2}" fill="none" stroke="${SILK}" stroke-width="0.6"/>` +
    `<g fill="${SILK}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">` +
    '<text x="24" y="22.5" font-size="2.4">PWR</text>' +
    `<text x="24.5" y="${MOD.d - 2.2}" font-size="2.4">DO</text></g>`;

/** Carrier: traces from the RJ11 socket to the header pads, the pin names and the title. */
const CARRIER_SILK = PIN_V.map((v, i) => {
    const y = MOD.y + v;
    const jy = (H / 2) + ((y - (MOD.y + (MOD.d / 2))) * 0.45) + 3.5;
    return `<path d="M 26 ${jy} L 30 ${jy} L 33 ${y} H ${MOD.x + 3}" fill="none" stroke="#6531a3" stroke-width="1.6" ` +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        `<text x="${MOD.x - 1.5}" y="${y - 2.2}" fill="${SILK}" font-family="Arial Narrow, sans-serif" font-size="2.2" ` +
        `text-anchor="end">${PIN_NAMES[i]}</text>`;
}).join('');

/** MQ-2 gas sensor: generic module on its header over the RJ11 carrier. */
export default {
    id: 'mq2',
    name: 'MQ-2 Gas Sensor',
    category: 'sensor',
    defaultPort: 'A3',
    spec: {
        w: W,
        h: H,
        jackY: MOD.y + (MOD.d / 2),
        label: 'MQ-2 GAS SENSOR',
        labelAt: [74, 6],
        labelSize: 4.4,
        holes: [[6, 6], [W - 6, 6], [6, H - 6]],
        silk: CARRIER_SILK
    },
    build (kit, g) {
        // black header spacer between the carrier and the module
        g.add(kit.box({
            x: MOD.x,
            y: MOD.y + PIN_V[0] - (PITCH / 2),
            w: 6,
            d: PITCH * 4,
            h: SPACER_H,
            z: TOP,
            color: BLACK
        }));

        // the module, in its own frame: (u, v) from its top-left corner, z = 0 at its underside
        const m = new Group();
        const [mx, my] = at(MOD.x, MOD.y);
        m.position.set(mx, my, TOP + SPACER_H);
        g.add(m);

        m.add(kit.slab({
            x: 0,
            y: 0,
            w: MOD.w,
            d: MOD.d,
            h: PCB_H,
            r: 1.5,
            top: {map: kit.tex.svg('mq2-module-top', MOD.w, MOD.d, MODULE_TOP, {ppu: 8, base: BLUE}), rough: 0.55},
            side: {color: '#123d70', rough: 0.6}
        }));

        // header pin tips with solder
        PIN_V.forEach(v => {
            m.add(kit.cylinder({cx: 3, cy: v, r: 1.5, z0: TOP, z1: TOP + 0.9, side: {color: '#cfd2d5', rough: 0.3, metal: 0.8}, seg: 16}));
            m.add(kit.box({x: 2.3, y: v - 0.7, w: 1.4, d: 1.4, h: 2.2, z: TOP, color: {color: '#d6b25a', rough: 0.3, metal: 0.85}, shadow: false}));
        });

        // LM393 comparator, load resistor, decoupling capacitor, PWR and DO LEDs
        soic(kit, m, {x: 10, y: 5, w: 12, d: 9.6});
        resistor(kit, m, 9, 18.5);
        capacitor(kit, m, 23, 25, false);
        smdLed(kit, m, 22, 17.5, '#ff3030');
        smdLed(kit, m, 22.5, MOD.d - 10, '#ff3030');

        // MQ-2: bakelite base and the double stainless gauze cap
        m.add(kit.cylinder({
            cx: SENSOR.u,
            cy: SENSOR.v,
            r: SENSOR.base,
            z0: TOP,
            z1: TOP + SENSOR.baseH,
            seg: 48,
            side: {color: '#a8601f', rough: 0.65},
            top: {color: '#bf6f27', rough: 0.6}
        }));
        meshCan(kit, m, {
            key: 'mq2-gauze',
            cx: SENSOR.u,
            cy: SENSOR.v,
            r: SENSOR.mesh,
            z0: TOP + SENSOR.baseH,
            z1: TOP + SENSOR.baseH + SENSOR.meshH,
            pitch: 1.8,
            topBase: '#c9cbcd',
            topDot: '#3a3c3e'
        });
    }
};
