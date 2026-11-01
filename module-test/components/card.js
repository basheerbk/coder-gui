import {CARD} from '../lib/board-data.js';

const CARD_T = 5;

/** Jack each output module plugs into in "plugged into board" mode. */
const CARD_PORTS = {
    relay: 'A3',
    servo: 'D13',
    l293d: 'J0',
    relay4: 'J0',
    stepper: 'STEPPER1',
    oled: 'I2C',
    ble: 'I2C1',
    hc05: 'UART1'
};

/**
 * A module without a 3D model yet: a rounded slab with its icon and name, like the studio's
 * edit-view card. The face artwork is exported per theme (assets/svg/card-<id>-<theme>.svg).
 */
const makeCard = mod => ({
    id: mod.id,
    name: mod.name,
    category: mod.category,
    kind: 'card',
    color: mod.color,
    defaultPort: CARD_PORTS[mod.id] || 'A1',
    /** The card slab with its top-left corner at (x, y) world units and its underside at z. */
    buildCard (kit, {theme = 'dark', x = 0, y = 0, z = 0} = {}) {
        return kit.slab({
            x,
            y,
            w: CARD.w,
            d: CARD.h,
            h: CARD_T,
            z,
            r: 12,
            top: {map: kit.tex.asset(`card-${mod.id}-${theme}`), rough: 0.5},
            side: {color: mod.color, rough: 0.5}
        });
    }
});

export {CARD_T, CARD_PORTS, makeCard};
