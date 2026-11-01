import {TOP, chip, resistor} from '../lib/parts.js';

const heartPath = (x, y, s) => `M${x},${y + (s * 0.3)} C${x},${y - (s * 0.2)} ${x - s},${y - (s * 0.2)} ${x - s},${y + (s * 0.3)}
    C${x - s},${y + (s * 0.7)} ${x},${y + s} ${x},${y + (s * 1.1)} C${x},${y + s} ${x + s},${y + (s * 0.7)} ${x + s},${y + (s * 0.3)}
    C${x + s},${y - (s * 0.2)} ${x},${y - (s * 0.2)} ${x},${y + (s * 0.3)} Z`;

const SENSOR_WINDOW = '<rect width="14" height="12" fill="#0c0c10"/>' +
    '<rect x="2" y="3" width="4.5" height="6" rx="0.8" fill="#2a0d12" stroke="#ff4d6d" stroke-width="0.5"/>' +
    '<rect x="7.5" y="3" width="4.5" height="6" rx="0.8" fill="#140d22" stroke="#9c7bff" stroke-width="0.5"/>';

/** HW-605 heartbeat sensor (MAX30102): optical sensor window, passives and a small regulator. */
export default {
    id: 'pulse',
    name: 'Heartbeat HW-605',
    category: 'sensor',
    defaultPort: 'I2C',
    spec: {
        w: 84,
        h: 48,
        jackY: 24,
        label: 'HW-605',
        labelAt: [56, 42],
        silk: `<path d="${heartPath(55, 6, 4)}" fill="#ff6b8a"/>`
    },
    build (kit, g) {
        g.add(kit.box({
            x: 48,
            y: 18,
            w: 14,
            d: 12,
            h: 2.2,
            z: TOP,
            color: {color: '#121216', rough: 0.4},
            faces: {t: {map: kit.tex.svg('pulse-sensor', 14, 12, SENSOR_WINDOW, {ppu: 12, base: '#0c0c10'}), rough: 0.2}}
        }));
        resistor(kit, g, 36, 6);
        resistor(kit, g, 36, 38);
        chip(kit, g, 66, 34, 7, 6, 1.6);
    }
};
