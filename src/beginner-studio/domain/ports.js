/**
 * Beginner Studio RJ11 ports — Maker ESP32 schematic (connector sheet).
 *
 * Jack → GPIO (signal pin used by single-wire modules listed first):
 *   STEPPER  IO12, IO13, IO14, IO27
 *   D13/D12  IO33
 *   3D       IO32, IO33, IO34  (IO34 is input-only)
 *   D5/D4    IO25, IO26        (one physical jack; beginner uses IO25)
 *   MD1      IO17, IO5, IO18, IO19
 *   I2C      IO21 SDA, IO22 SCL (I2C1 is the same bus)
 *   A1       IO4
 *   A2/A0    IO15  (strapping)
 *   A3/A1    IO2   (strapping)
 *   A4/A0    IO0   (BOOT / strapping)
 *
 * UART RX/TX has no GPIO numbers on the connector sheet — omitted here.
 */

const PORTS = [
    {id: 'STEPPER', label: 'ST', side: 'top', kind: 'stepper', signal: 'stepper', pin: '12', pins: ['12', '13', '14', '27'], strapping: true, index: 0},
    {id: 'D13', label: 'D13', side: 'top', kind: 'digital', signal: 'digital', pin: '33', pins: ['33'], index: 1},
    {id: '3D', label: '3D', side: 'top', kind: 'digital', signal: 'digital', pin: '32', pins: ['32', '33', '34'], inputOnly: ['34'], index: 2},
    {id: 'D4', label: 'D4', side: 'top', kind: 'digital', signal: 'digital', pin: '25', pins: ['25', '26'], index: 3},
    {id: 'MD', label: 'MD', side: 'right', kind: 'motor', signal: 'motor', pin: '5', pins: ['17', '5', '18', '19'], index: 0},
    {id: 'I2C', label: 'I2C', side: 'right', kind: 'i2c', signal: 'i2c', pin: '21', pins: ['21', '22'], index: 1},
    {id: 'A3', label: 'A3', side: 'right', kind: 'analog', signal: 'analog', pin: '2', pins: ['2'], strapping: true, adc: 2, index: 2},
    {id: 'A2', label: 'A2', side: 'right', kind: 'analog', signal: 'analog', pin: '15', pins: ['15'], strapping: true, adc: 2, index: 3},
    {id: 'A1', label: 'A1', side: 'bottom', kind: 'analog', signal: 'analog', pin: '4', pins: ['4'], adc: 2, index: 0},
    {id: 'A4', label: 'A4', side: 'bottom', kind: 'analog', signal: 'analog', pin: '0', pins: ['0'], strapping: true, boot: true, adc: 2, index: 1}
];

const ANALOG_ASSIGN = ['A1', 'A2', 'A3', 'A4'];
const DIGITAL_ASSIGN = ['D4', 'D13', '3D', 'A1', 'A2', 'A3', 'A4'];

/** Landscape controller — room for 4 top / 4 right / 2 bottom jacks. */
const BOARD = {x: 150, y: 105, w: 480, h: 300};
const JACK = {w: 30, h: 36};
const CARD = {w: 112, h: 38};
const STUB = 56;
const DEPTH = {x: 3, y: 10};

const extrudeFaces = (x, y, w, h, dx = DEPTH.x, dy = DEPTH.y) => ({
    bottom: `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w + dx} ${y + h + dy} L ${x + dx} ${y + h + dy} Z`,
    right: `M ${x + w} ${y} L ${x + w + dx} ${y + dy} L ${x + w + dx} ${y + h + dy} L ${x + w} ${y + h} Z`
});

const portById = id => PORTS.find(p => p.id === id) || null;

const neededKind = moduleDef => {
    if (!moduleDef) {
        return null;
    }
    if (moduleDef.id === 'oled') {
        return 'i2c';
    }
    if (moduleDef.id === 'dc') {
        return 'motor';
    }
    if (moduleDef.signal === 'analog') {
        return 'analog';
    }
    return 'digital';
};

const isPortCompatible = (port, moduleDef) => {
    if (!port || !moduleDef) {
        return false;
    }
    const need = neededKind(moduleDef);
    if (need === 'i2c') {
        return port.kind === 'i2c';
    }
    if (need === 'motor') {
        return port.kind === 'motor';
    }
    if (need === 'analog') {
        return port.kind === 'analog';
    }
    if (need === 'digital') {
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
            return 'I2C is for the OLED screen (SDA 21 / SCL 22)';
        }
        if (port.kind === 'motor') {
            return 'MD is the motor-driver jack';
        }
        if (port.boot) {
            return 'A4 is IO0 (BOOT) — avoid holding it LOW at reset';
        }
        return `${port.label} · GPIO ${port.pin}`;
    }
    const need = neededKind(moduleDef);
    if (need === 'i2c') {
        return 'Plug the OLED into I2C';
    }
    if (need === 'motor') {
        return 'Plug the DC motor into MD';
    }
    if (need === 'analog') {
        return `${port.label} needs an analog sensor`;
    }
    if (port.kind === 'stepper') {
        return 'ST is only for a stepper motor';
    }
    if (port.kind === 'i2c') {
        return 'I2C needs the OLED screen';
    }
    if (port.kind === 'motor') {
        return 'MD needs a DC motor';
    }
    return `${port.label} needs a digital part`;
};

const pickPortForModule = (moduleDef, usedIds) => {
    const used = usedIds || {};
    const take = ids => ids.find(id => !used[id] && isPortCompatible(portById(id), moduleDef));
    const need = neededKind(moduleDef);
    if (need === 'i2c') {
        return take(['I2C']);
    }
    if (need === 'motor') {
        return take(['MD']);
    }
    if (need === 'analog') {
        return take(ANALOG_ASSIGN);
    }
    return take(DIGITAL_ASSIGN);
};

const topBottomX = (index, count) => {
    const margin = 48;
    const span = BOARD.w - (margin * 2) - JACK.w;
    const step = count <= 1 ? 0 : span / (count - 1);
    return BOARD.x + margin + (index * step);
};

const portPosition = port => {
    if (port.side === 'top') {
        const count = PORTS.filter(p => p.side === 'top').length;
        const x = topBottomX(port.index, count);
        const y = BOARD.y - JACK.h + 5;
        const cableX = x + (JACK.w / 2);
        const cableY = y;
        return {
            x,
            y,
            cableX,
            cableY,
            cardX: cableX - (CARD.w / 2),
            cardY: y - STUB - CARD.h
        };
    }
    if (port.side === 'bottom') {
        const count = PORTS.filter(p => p.side === 'bottom').length;
        const x = topBottomX(port.index, count);
        const y = BOARD.y + BOARD.h - 5;
        const cableX = x + (JACK.w / 2);
        const cableY = y + JACK.h;
        return {
            x,
            y,
            cableX,
            cableY,
            cardX: cableX - (CARD.w / 2),
            cardY: cableY + STUB
        };
    }
    if (port.side === 'left') {
        const y = BOARD.y + 60 + (port.index * 70);
        const x = BOARD.x - JACK.w + 5;
        const cableY = y + (JACK.h / 2);
        return {
            x,
            y,
            cableX: x,
            cableY,
            cardX: x - STUB - CARD.w,
            cardY: cableY - (CARD.h / 2)
        };
    }
    const count = PORTS.filter(p => p.side === 'right').length;
    const step = count <= 1 ? 0 : 58;
    const y = BOARD.y + 42 + (port.index * step);
    const x = BOARD.x + BOARD.w - 5;
    const cableY = y + (JACK.h / 2);
    return {
        x,
        y,
        cableX: x + JACK.w,
        cableY,
        cardX: x + JACK.w + STUB,
        cardY: cableY - (CARD.h / 2)
    };
};

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

export {
    PORTS,
    BOARD,
    JACK,
    CARD,
    STUB,
    DEPTH,
    ANALOG_ASSIGN,
    DIGITAL_ASSIGN,
    extrudeFaces,
    portById,
    neededKind,
    isPortCompatible,
    compatibilityHint,
    pickPortForModule,
    portPosition,
    cardCablePoint
};
