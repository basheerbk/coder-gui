import {TOP, glowDecal, resistor} from '../lib/parts.js';

/** 5 mm LED module: series resistor and a yellow dome with a soft glow. */
export default {
    id: 'led',
    name: 'LED',
    category: 'output',
    defaultPort: 'A2',
    spec: {w: 104, h: 48, jackY: 24, label: 'LED', labelAt: [80, 8]},
    build (kit, g, {options}) {
        resistor(kit, g, 50, 13);
        if (options.on !== false) {
            g.add(glowDecal(kit, {cx: 80, cy: 26, size: 44, z: TOP + 0.2, color: '#ffd628', opacity: 0.55}));
        }
        g.add(kit.lathe({
            key: 'led5mm',
            cx: 80,
            cy: 26,
            z: TOP,
            profile: [[0, 0], [7.5, 0], [7.5, 1.2], [6.6, 1.2], [6.6, 8.6], [6.2, 9.8], [5.2, 10.8], [3.6, 11.5], [0, 11.8]],
            material: {
                color: '#f2c200',
                rough: 0.22,
                emissive: '#ffb800',
                emissiveIntensity: options.on === false ? 0 : 0.4,
                opacity: 0.94
            }
        }));
    }
};
