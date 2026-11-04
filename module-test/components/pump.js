import {lead} from '../lib/breakout.js';
import {axial} from '../lib/parts.js';
import {ADAPTER_W, adapterSpec, buildAdapter} from './mosfet.js';

/** Mini submersible water pump (3–6 V) wired to the MOSFET adapter, with a clear outlet tube. */
const P = {x0: ADAPTER_W + 40, len: 108, r: 29, cy: 32};

export default {
    id: 'pump',
    name: 'Water Pump + MOSFET Adapter',
    category: 'output',
    defaultPort: 'J0',
    spec: adapterSpec('PUMP DRIVER'),
    build (kit, g) {
        const out = buildAdapter(kit, g);
        const {x0, len, r, cy} = P;
        const cz = r;
        g.add(axial(kit, {x0, x1: x0 + len, cy, cz, r, seg: 48, side: {color: '#1c1d20', rough: 0.45}, top: {color: '#232428', rough: 0.5}, bottom: {color: '#232428', rough: 0.5}}));
        // inlet slots ring and the outlet nozzle on the far end
        g.add(axial(kit, {x0: x0 + len - 22, x1: x0 + len - 20, cy, cz, r: r + 0.3, seg: 48, side: {color: '#0c0c0e', rough: 0.6}}));
        g.add(axial(kit, {x0: x0 + len, x1: x0 + len + 18, cy, cz: cz + 12, r: 4.4, seg: 24, side: {color: '#232428', rough: 0.4}, top: {color: '#0c0c0e'}}));
        // clear silicone tube from the nozzle
        lead(kit, g, ['#dfeaf0'], () => [
            [x0 + len + 16, cy, cz + 12],
            [x0 + len + 40, cy, cz + 12],
            [x0 + len + 62, cy - 20, 6],
            [x0 + len + 60, cy - 70, 6]
        ], 5.2);
        g.children[g.children.length - 1].material = kit.mat({color: '#dfeaf0', rough: 0.1, opacity: 0.45});
        lead(kit, g, ['#d0302a', '#151515'], k => [
            [out.x, out.y + (k * 12), out.z],
            [out.x + 14, out.y + (k * 6), 6],
            [x0 - 18, cy + (k * 4), 1.3],
            [x0 + 2, cy + (k * 6), cz]
        ], 1.3);
    }
};
