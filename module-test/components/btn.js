import {TOP, resistor} from '../lib/parts.js';

const CAP_TOP = '<defs><linearGradient id="bt" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#e3e4e5"/><stop offset="100%" stop-color="#9fa1a3"/></linearGradient></defs>' +
    '<rect width="24" height="24" fill="url(#bt)"/>' +
    [[3, 3], [21, 3], [3, 21], [21, 21]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#6d6f71"/>`).join('');

/** Tactile push button: 12 mm switch body with a metal top and a red cap. */
export default {
    id: 'btn',
    name: 'Push Button',
    category: 'input',
    defaultPort: 'D13',
    spec: {w: 96, h: 48, jackY: 24, label: 'BUTTON', labelAt: [66, 44]},
    build (kit, g, {options}) {
        resistor(kit, g, 38, 38);
        g.add(kit.box({
            x: 54,
            y: 12,
            w: 24,
            d: 24,
            h: 6,
            z: TOP,
            color: {color: '#1c1c1c', rough: 0.5},
            faces: {t: {map: kit.tex.svg('btn-top', 24, 24, CAP_TOP, {ppu: 8, base: '#c0c2c4'}), rough: 0.35, metal: 0.5}}
        }));
        const cap = options.capColor || '#d32f2f';
        g.add(kit.cylinder({
            cx: 66,
            cy: 24,
            r: 7.5,
            z0: TOP + 6,
            z1: TOP + 10.4,
            side: {color: options.capSide || (options.capColor ? cap : '#9e1c1c'), rough: 0.45},
            top: {color: cap, rough: 0.35}
        }));
    }
};
