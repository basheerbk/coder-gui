import {lead} from '../lib/breakout.js';
import {axial} from '../lib/parts.js';
import {ADAPTER_W, adapterSpec, buildAdapter} from './mosfet.js';

/*
 * 12 V solenoid door lock (54 × 41 × 28 mm) wired to the MOSFET adapter: open steel frame, the
 * tape-wrapped coil and the slanted latch bolt sticking out of the far end.
 */
const L = {x: ADAPTER_W + 46, y: 32 - 49, w: 130, d: 98, h: 67};
const ZINC = {color: '#c7c9c4', rough: 0.35, metal: 0.8};
const BOLT = [[0, 0], [30, 0], [44, 34], [0, 34]];

export default {
    id: 'solenoid',
    name: 'Solenoid Lock 12V + MOSFET Adapter',
    category: 'output',
    defaultPort: 'J0',
    spec: adapterSpec('LOCK DRIVER'),
    build (kit, g) {
        const out = buildAdapter(kit, g);
        const {x, y, w, d, h} = L;
        // frame: base plate, two end walls, and the side flange with its mounting holes
        g.add(kit.box({x, y, w, d, h: 3, z: 0, color: ZINC}));
        g.add(kit.box({x, y, w: 4, d, h, z: 0, color: ZINC}));
        g.add(kit.box({x: x + w - 4, y, w: 4, d, h, z: 0, color: ZINC}));
        g.add(kit.box({x, y: y + d - 4, w, d: 4, h: h - 10, z: 0, color: ZINC}));
        [x + 24, x + w - 24].forEach(cx => g.add(kit.cylinder({cx, cy: y + d - 2, r: 4, z0: h - 22, z1: h - 18, seg: 16, side: {color: '#0d0f12'}})));
        // coil wrapped in yellow-black tape, plunger
        g.add(axial(kit, {x0: x + 10, x1: x + 90, cy: y + (d / 2) - 4, cz: 35, r: 30, seg: 40, side: {color: '#1d1d1f', rough: 0.6}, top: {color: '#e8c33a', rough: 0.6}, bottom: {color: '#e8c33a', rough: 0.6}}));
        g.add(axial(kit, {x0: x + 90, x1: x + w - 4, cy: y + (d / 2) - 4, cz: 35, r: 9, seg: 24, side: ZINC}));
        // slanted latch bolt out of the far wall
        g.add(kit.slab({x: x + w, y: y + (d / 2) - 21, w: 44, d: 34, h: 26, z: 22, outline: BOLT, top: ZINC, side: ZINC}));
        lead(kit, g, ['#d0302a', '#151515'], k => [
            [out.x, out.y + (k * 12), out.z],
            [out.x + 14, out.y + (k * 6), 6],
            [x - 14, 32 + (k * 4), 1.3],
            [x + 6, 32 + (k * 6), 20]
        ], 1.3);
    }
};
