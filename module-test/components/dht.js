import {TOP, resistor} from '../lib/parts.js';

const GRILLE = '<rect width="52" height="40" fill="#4b92e0"/>' +
    [0, 1, 2, 3, 4].map(row => [0, 1, 2, 3, 4, 5].map(col => (
        `<rect x="${5 + (col * 7.4)}" y="${5 + (row * 6.4)}" width="4.4" height="3.6" rx="0.6" fill="#1d4f8f"/>`
    )).join('')).join('');

/** DHT11 temperature and humidity sensor: blue vented housing. */
export default {
    id: 'dht',
    name: 'DHT11 Temp & Humid',
    category: 'sensor',
    defaultPort: 'D13',
    spec: {w: 112, h: 56, jackY: 28, label: 'DHT11', labelAt: [76, 53]},
    build (kit, g) {
        resistor(kit, g, 36, 4);
        g.add(kit.slab({
            x: 50,
            y: 8,
            w: 52,
            d: 40,
            h: 13,
            z: TOP,
            r: 1.5,
            top: {map: kit.tex.svg('dht-top', 52, 40, GRILLE, {ppu: 8, base: '#4b92e0'}), rough: 0.55},
            side: {color: '#3a7fcf', rough: 0.55}
        }));
    }
};
