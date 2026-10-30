/**
 * Beginner Studio RJ11 ports — Maker ESP32 schematic (connector sheet).
 *
 * Jack → GPIO (signal pin used by single-wire modules listed first):
 *   STEPPER  IO12, IO13, IO14, IO27
 *   D13/D12  IO33
 *   3D       IO32 SS, IO33 RST, IO34 MISO (input-only)
 *   D5       IO25 Echo (RJ pin 2), IO26 Trig (RJ pin 3); pins 4–5 NC.
 *   MD1      RJ: 1=VCC, 2=IO17, 3=IO5, 4=IO18, 5=IO19, 6=GND
 *            Motor A = IO17+IO5 | Motor B = IO18+IO19
 *   I2C      IO21 SDA, IO22 SCL (I2C1 is the same bus)
 *   A1       IO4
 *   A2/A0    IO15  (strapping)
 *   A3/A1    IO2   (strapping)
 *   A4/A0    IO0   (BOOT / strapping)
 *
 * RC522 SPI bus (not on D5 — HC-SR04 keeps 25/26):
 *   SCK=16, MOSI=23 on-board; SS/RST/MISO via 3D jack.
 * D13 and 3D both use IO33 — mutually exclusive.
 *
 * UART (HC-05): RX=GPIO3 TX=GPIO1 — shared with USB serial @ 9600.
 *
 * On screen the ports sit on the RJ11 Hub's jacks (see hubJacks.js); `side` is the edge the
 * plug enters from.
 */

import {ESP_MODULE, HUB, HUB_PORTS, HUB_SCALE} from '../../../module-test/components/hub-layout.js';

import {HUB_JACK} from './hubJacks';
import {moduleById} from './modules';

/** Shared GPIO conflict groups (jack ids). */
const PORT_CONFLICTS = {
    D13: ['3D'],
    '3D': ['D13']
};

const HUB_PORT_BY_ID = HUB_PORTS.reduce((all, p) => Object.assign(all, {[p.id]: p}), {});

/** Hub jack record and plug side for a studio port id. */
const onHub = id => {
    const hub = HUB_PORT_BY_ID[HUB_JACK[id]];
    return {hub: hub.id, side: hub.side};
};

const PORTS = [
    {id: 'A4', label: 'A4', kind: 'analog', signal: 'analog', pin: '0', pins: ['0'], strapping: true, boot: true, adc: 2, ...onHub('A4')},
    {
        id: 'D5',
        label: 'D5',
        kind: 'digital',
        signal: 'digital',
        pin: '25',
        pins: ['25', '26'],
        // HC-SR04 kit cable: RJ pin2 → Echo, RJ pin3 → Trig (swapped vs silk order).
        // Echo must never be OUTPUT — driving it heats the module.
        ultra: {trig: '26', echo: '25'},
        ...onHub('D5')
    },
    {id: 'STEPPER', label: 'ST', kind: 'stepper', signal: 'stepper', pin: '12', pins: ['12', '13', '14', '27'], strapping: true, ...onHub('STEPPER')},
    {id: 'A1', label: 'A1', kind: 'analog', signal: 'analog', pin: '4', pins: ['4'], adc: 2, ...onHub('A1')},
    {id: 'D13', label: 'D13', kind: 'digital', signal: 'digital', pin: '33', pins: ['33'], ...onHub('D13')},
    {id: 'I2C', label: 'I2C', kind: 'i2c', signal: 'i2c', pin: '21', pins: ['21', '22'], ...onHub('I2C')},
    {id: 'I2C1', label: 'I2C1', kind: 'i2c', signal: 'i2c', pin: '21', pins: ['21', '22'], ...onHub('I2C1')},
    {
        id: 'MD',
        label: 'MD',
        kind: 'motor',
        signal: 'motor',
        pin: '17',
        pins: ['17', '5', '18', '19'],
        // Dual H-bridge: Motor A = IO17/IO5, Motor B = IO18/IO19
        motors: {
            A: {in1: '17', in2: '5'},
            B: {in1: '18', in2: '19'}
        },
        ...onHub('MD')
    },
    {id: 'A3', label: 'A3', kind: 'analog', signal: 'analog', pin: '2', pins: ['2'], strapping: true, adc: 2, ...onHub('A3')},
    {id: 'A2', label: 'A2', kind: 'analog', signal: 'analog', pin: '15', pins: ['15'], strapping: true, adc: 2, ...onHub('A2')},
    // HC-05 Classic Bluetooth UART (shares USB Serial pins)
    {
        id: 'UART',
        label: 'UART',
        kind: 'uart',
        signal: 'uart',
        pin: '3',
        pins: ['3', '1'],
        uart: {rx: '3', tx: '1'},
        ...onHub('UART')
    },
    {
        id: '3D',
        label: '3D',
        kind: 'spi',
        signal: 'digital',
        pin: '32',
        pins: ['32', '33', '34'],
        inputOnly: ['34'],
        spi: {ss: '32', rst: '33', miso: '34', sck: '16', mosi: '23'},
        ...onHub('3D')
    },
    // Built-in ESP32 radios — tap the ESP32 module itself; its card sits below the board
    {id: 'ONBOARD', label: 'ESP', side: 'bottom', kind: 'onboard', signal: 'onboard', pin: '-', pins: [], hub: null}
];

const ANALOG_ASSIGN = ['A1', 'A2', 'A3', 'A4'];
const DIGITAL_ASSIGN = ['D5', 'D13', 'A1', 'A2', 'A3', 'A4'];

/** The RJ11 Hub's outline in world units; jacks overhang its edges. */
const BOARD = {x: 0, y: 0, w: HUB.w * HUB_SCALE, h: HUB.h * HUB_SCALE};
/** A module's RJ11 socket (and the old flat jack): 30 deep × 36 across. */
const JACK = {w: 30, h: 36};
/** The ESP32 module on the hub: ONBOARD's tap target. */
const ESP = {
    x: BOARD.x + (ESP_MODULE.x * HUB_SCALE),
    y: BOARD.y + (ESP_MODULE.y * HUB_SCALE),
    w: ESP_MODULE.w * HUB_SCALE,
    d: ESP_MODULE.d * HUB_SCALE,
    h: ESP_MODULE.h * HUB_SCALE
};
const CARD = {w: 112, h: 38};
const STUB = 56;
const DEPTH = {x: 3, y: 10};

const extrudeFaces = (x, y, w, h, dx = DEPTH.x, dy = DEPTH.y) => ({
    bottom: `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w + dx} ${y + h + dy} L ${x + dx} ${y + h + dy} Z`,
    right: `M ${x + w} ${y} L ${x + w + dx} ${y + dy} L ${x + w + dx} ${y + h + dy} L ${x + w} ${y + h} Z`
});

const portById = id => {
    if (id === 'D4') {
        return PORTS.find(p => p.id === 'D5') || null;
    }
    return PORTS.find(p => p.id === id) || null;
};

const neededKind = moduleDef => {
    if (!moduleDef) {
        return null;
    }
    if (moduleDef.onboard || moduleDef.id === 'ble') {
        return 'onboard';
    }
    if (moduleDef.id === 'hc05') {
        return 'uart';
    }
    if (moduleDef.i2c || moduleDef.id === 'oled' || moduleDef.id === 'pulse') {
        return 'i2c';
    }
    if (moduleDef.id === 'l293d' || moduleDef.id === 'dc' || moduleDef.id === 'relay4') {
        return 'motor';
    }
    if (moduleDef.id === 'stepper') {
        return 'stepper';
    }
    if (moduleDef.id === 'rfid') {
        return 'spi';
    }
    if (moduleDef.id === 'ultra') {
        return 'ultra';
    }
    if (moduleDef.signal === 'analog') {
        return 'analog';
    }
    return 'digital';
};

const isPortBlockedByConflicts = (portId, usedIds) => {
    const used = usedIds || {};
    const rivals = PORT_CONFLICTS[portId] || [];
    return rivals.some(id => used[id]);
};

const isPortCompatible = (port, moduleDef, usedIds) => {
    if (!port || !moduleDef) {
        return false;
    }
    if (isPortBlockedByConflicts(port.id, usedIds)) {
        return false;
    }
    // Digital modules must not steal D5 when HC-SR04 needs it, or D13 when RFID is on 3D.
    if (usedIds && usedIds.D5 && port.id === 'D5' && moduleDef.id !== 'ultra') {
        return false;
    }
    const need = neededKind(moduleDef);
    if (need === 'onboard') {
        return port.kind === 'onboard';
    }
    if (need === 'uart') {
        return port.kind === 'uart';
    }
    if (need === 'i2c') {
        return port.kind === 'i2c';
    }
    if (need === 'motor') {
        return port.kind === 'motor';
    }
    if (need === 'stepper') {
        return port.kind === 'stepper';
    }
    if (need === 'spi') {
        return port.kind === 'spi';
    }
    if (need === 'ultra') {
        return port.id === 'D5' || (port.pins && port.pins.length >= 2 && port.kind === 'digital');
    }
    if (need === 'analog') {
        return port.kind === 'analog';
    }
    if (need === 'digital') {
        // D5 is reserved for HC-SR04 (dual GPIO). Driving it as a plain
        // digital out can hold Trig HIGH or fight Echo → module heats.
        if (port.id === 'D5') {
            return false;
        }
        return port.kind === 'digital' || port.kind === 'analog';
    }
    return false;
};

const compatibilityHint = (port, moduleDef) => {
    if (!port) {
        return 'Unknown jack';
    }
    if (!moduleDef) {
        if (port.kind === 'stepper') {
            return 'ST is the 4-wire stepper jack (IO12–27)';
        }
        if (port.kind === 'i2c') {
            return 'I2C bus (SDA 21 / SCL 22) — OLED and HW-605';
        }
        if (port.kind === 'motor') {
            return 'MD jack — L293D (A:17/5 B:18/19) or 4-ch relay';
        }
        if (port.kind === 'spi') {
            return '3D is for RFID RC522 (SPI)';
        }
        if (port.kind === 'onboard') {
            return 'Built-in ESP32 Bluetooth';
        }
        if (port.kind === 'uart') {
            return 'UART for HC-05 (RX=3 TX=1, USB-shared)';
        }
        if (port.id === 'D5') {
            return 'D5 is HC-SR04 / digital (Echo IO25 + Trig IO26)';
        }
        if (port.boot) {
            return 'A4 is IO0 (BOOT) — avoid holding it LOW at reset';
        }
        return `${port.label} · GPIO ${port.pin}`;
    }
    const need = neededKind(moduleDef);
    if (need === 'onboard') {
        return 'Bluetooth is built into the ESP32 — tap the ESP32 chip';
    }
    if (need === 'uart') {
        return 'Plug HC-05 into UART (RX=GPIO3 TX=GPIO1, shared with USB @ 9600)';
    }
    if (need === 'i2c') {
        return 'Plug into I2C or I2C1 (one bus: OLED / HW-605 share SDA 21 · SCL 22)';
    }
    if (need === 'motor') {
        return 'Plug into MD — L293D motors or 4-ch relay (IO17/5/18/19)';
    }
    if (need === 'stepper') {
        return 'Plug the stepper into ST';
    }
    if (need === 'spi') {
        return 'Plug the RFID RC522 into 3D (not D13 — they share IO33)';
    }
    if (need === 'ultra') {
        return 'Plug the HC-SR04 into D5 only (Trig IO26 / Echo IO25 — Echo stays INPUT)';
    }
    if (need === 'analog') {
        return `${port.label} needs an analog sensor`;
    }
    if (port.id === 'D5') {
        return 'D5 is reserved for the HC-SR04 ultrasonic module';
    }
    if (port.kind === 'stepper') {
        return 'ST is only for a stepper motor';
    }
    if (port.kind === 'i2c') {
        return 'I2C needs an I2C part (OLED or HW-605)';
    }
    if (port.kind === 'motor') {
        return 'MD needs the L293D driver';
    }
    if (port.kind === 'spi') {
        return '3D needs the RFID module';
    }
    if (port.kind === 'onboard') {
        return 'ESP is only for Bluetooth';
    }
    if (port.kind === 'uart') {
        return 'UART is only for the HC-05 module';
    }
    if (port.id === 'D13' && PORT_CONFLICTS.D13) {
        return 'D13 shares IO33 with RFID on 3D — unplug RFID first';
    }
    if (port.id === '3D') {
        return '3D shares IO33 with D13 — free D13 first';
    }
    return `${port.label} needs a digital part`;
};

const pickPortForModule = (moduleDef, usedIds) => {
    const used = usedIds || {};
    const take = ids => ids.find(id => !used[id] && isPortCompatible(portById(id), moduleDef, used));
    const need = neededKind(moduleDef);
    if (need === 'onboard') {
        return take(['ONBOARD']);
    }
    if (need === 'uart') {
        return take(['UART']);
    }
    if (need === 'i2c') {
        // One shared bus: take a free I2C jack, else share I2C.
        const port = portById('I2C');
        return take(['I2C', 'I2C1']) || (port && isPortCompatible(port, moduleDef, used) ? 'I2C' : null);
    }
    if (need === 'motor') {
        return take(['MD']);
    }
    if (need === 'stepper') {
        return take(['STEPPER']);
    }
    if (need === 'spi') {
        return take(['3D']);
    }
    if (need === 'ultra') {
        return take(['D5']);
    }
    if (moduleDef.id === 'dht') {
        // GPIO33 (D13) is unreliable for DHT one-wire on ESP32 — prefer A1 (IO4).
        return take(['A1', 'A2', 'A3', 'D13']);
    }
    if (need === 'analog') {
        return take(ANALOG_ASSIGN);
    }
    // Never auto-assign D5 to plain digital parts (HC-SR04 only).
    return take(['D13', 'A1', 'A2', 'A3', 'A4']);
};

/** Where a card for a plug leaving (x, y) towards `side` goes. */
const cardSpot = (x, y, side) => {
    if (side === 'top') {
        return {cardX: x - (CARD.w / 2), cardY: y - STUB - CARD.h};
    }
    if (side === 'bottom') {
        return {cardX: x - (CARD.w / 2), cardY: y + STUB};
    }
    if (side === 'left') {
        return {cardX: x - STUB - CARD.w, cardY: y - (CARD.h / 2)};
    }
    return {cardX: x + STUB, cardY: y - (CARD.h / 2)};
};

const positionOf = port => {
    const hub = HUB_PORT_BY_ID[port.hub];
    if (!hub) {
        // ONBOARD: the ESP32 module; its card hangs below the board, wireless
        const footprint = {x: ESP.x, y: ESP.y, w: ESP.w, d: ESP.d};
        const cableX = ESP.x + (ESP.w / 2);
        const cableY = BOARD.y + BOARD.h;
        return {x: ESP.x, y: ESP.y, footprint, D: ESP.d, Wd: ESP.w, cableX, cableY, ...cardSpot(cableX, cableY, 'bottom')};
    }
    const fp = hub.footprint;
    const footprint = {x: BOARD.x + fp.x, y: BOARD.y + fp.y, w: fp.w, d: fp.d};
    const cableX = BOARD.x + hub.pos.x;
    const cableY = BOARD.y + hub.pos.y;
    return {
        x: footprint.x,
        y: footprint.y,
        footprint,
        D: hub.jack.D,
        Wd: hub.jack.Wd,
        open: hub.open,
        cableX,
        cableY,
        ...cardSpot(cableX, cableY, port.side)
    };
};

const POSITIONS = PORTS.reduce((all, port) => Object.assign(all, {[port.id]: positionOf(port)}), {});

/**
 * Jack geometry in world units: footprint {x, y, w, d} (x, y repeat its corner), D deep × Wd
 * across, open (W/E/N/S), the mouth cableX/Y where cables plug in and the default card corner.
 */
const portPosition = port => POSITIONS[port.id];

/** Hub jacks with no studio port (drawn, never used). */
const SPARE_JACKS = HUB_PORTS
    .filter(hub => !PORTS.some(port => port.hub === hub.id))
    .map(hub => ({
        id: hub.id,
        side: hub.side,
        open: hub.open,
        footprint: {x: BOARD.x + hub.footprint.x, y: BOARD.y + hub.footprint.y, w: hub.footprint.w, d: hub.footprint.d},
        D: hub.jack.D,
        Wd: hub.jack.Wd
    }));

/** Cable attach point on a module card at (cardX, cardY) for a given port side. */
const cardCablePoint = (cardX, cardY, side) => {
    if (side === 'top') {
        return {x: cardX + (CARD.w / 2), y: cardY + CARD.h};
    }
    if (side === 'bottom') {
        return {x: cardX + (CARD.w / 2), y: cardY};
    }
    if (side === 'left') {
        return {x: cardX + CARD.w, y: cardY + (CARD.h / 2)};
    }
    return {x: cardX, y: cardY + (CARD.h / 2)};
};

const sharesI2cBus = (port, moduleDef) => Boolean(
    moduleDef &&
    port.kind === 'i2c' &&
    (moduleDef.i2c || moduleDef.id === 'oled' || moduleDef.id === 'pulse')
);

/** How a jack should look while `selectedDef` (or nothing) is picked in the shelf. */
const portUiState = (port, usedPorts, selectedDef) => {
    const conn = usedPorts[port.id];
    const shareI2c = sharesI2cBus(port, selectedDef);
    const fits = Boolean(selectedDef) && isPortCompatible(port, selectedDef, usedPorts);
    const compatible = fits && (!conn || shareI2c);
    return {
        occupied: Boolean(conn) && !shareI2c,
        compatible,
        dimmed: Boolean(selectedDef) && !fits,
        shareI2c
    };
};

const usedPortMap = connections => {
    const map = {};
    connections.forEach(c => {
        map[c.portId] = c;
    });
    return map;
};

/** portId → {dir, color} for every plugged jack; drives trace pulses and the activity LED. */
const portLinks = (connections, K) => {
    const map = {};
    connections.forEach(c => {
        const port = portById(c.portId);
        const def = moduleById(c.moduleId);
        if (port) {
            map[port.id] = {
                dir: def && def.dir === 'in' ? 'in' : 'out',
                color: port.signal === 'analog' ? K.analog : K.digital
            };
        }
    });
    return map;
};

const portColor = (port, K) => {
    if (port.kind === 'analog') {
        return K.analog;
    }
    if (port.kind === 'i2c' || port.kind === 'onboard') {
        return K.cyan;
    }
    if (port.kind === 'motor') {
        return K.orange;
    }
    if (port.kind === 'stepper') {
        return K.dim;
    }
    if (port.kind === 'spi') {
        return K.purple;
    }
    return K.digital;
};

export {
    PORTS,
    PORT_CONFLICTS,
    BOARD,
    JACK,
    ESP,
    SPARE_JACKS,
    CARD,
    STUB,
    DEPTH,
    ANALOG_ASSIGN,
    DIGITAL_ASSIGN,
    extrudeFaces,
    portById,
    neededKind,
    isPortBlockedByConflicts,
    isPortCompatible,
    compatibilityHint,
    pickPortForModule,
    portPosition,
    cardCablePoint,
    portUiState,
    usedPortMap,
    portLinks,
    portColor
};
