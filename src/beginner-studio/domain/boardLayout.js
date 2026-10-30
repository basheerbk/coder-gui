import {
    HUB_SCALE,
    LEDS as HUB_LEDS,
    TRACES as HUB_TRACES,
    pathD
} from '../../../module-test/components/hub-layout.js';

import {BOARD, PORTS} from './ports';

/**
 * The RJ11 Hub's live parts for the studio views. Hub units are the hub artwork's own (y down,
 * multiply by HUB_SCALE for world units); world units are relative to BOARD.
 */

/** Copper traces per studio port, as SVG paths in hub units (reverse runs ESP32 → jack). */
const TRACES = PORTS
    .filter(port => port.hub && HUB_TRACES[port.hub])
    .map(port => ({
        id: port.id,
        lines: HUB_TRACES[port.hub].map(line => ({d: pathD(line), reverse: pathD(line.slice().reverse())}))
    }));

/** portId → traces as world-unit polylines (the 3D view's live copper). */
const TRACE_POINTS = PORTS.reduce((all, port) => {
    if (port.hub && HUB_TRACES[port.hub]) {
        all[port.id] = HUB_TRACES[port.hub].map(line => line.map(([x, y]) => [
            BOARD.x + (x * HUB_SCALE),
            BOARD.y + (y * HUB_SCALE)
        ]));
    }
    return all;
}, {});

/** Status LEDs in hub units: power is always on, activity blinks while modules are plugged in, heartbeat pulses. */
const LEDS = HUB_LEDS;

/** World-space area (board, jacks and default module spots) both build views frame. */
const SCENE = {x: -270, y: -200, w: 750, h: 600};

export {
    SCENE,
    HUB_SCALE,
    TRACES,
    TRACE_POINTS,
    LEDS
};
