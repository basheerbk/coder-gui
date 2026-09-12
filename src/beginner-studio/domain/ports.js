/**
 * Beginner Studio RJ11 ports — aligned with Maker ESP32 hardware.
 * Source of truth: static/extensions/makerEsp32/pin-map.js
 */
const PORTS = [
    // Digital RJ11 — top edge
    {id: 'D4', label: 'D4', side: 'top', signal: 'digital', pin: '25', index: 0},
    {id: 'D5', label: 'D5', side: 'top', signal: 'digital', pin: '26', index: 1},
    {id: 'D13', label: 'D13', side: 'top', signal: 'digital', pin: '33', index: 2},
    // Digital RJ11 — right edge (board SPARE jacks)
    {id: 'SPARE1', label: 'S1', side: 'right', signal: 'digital', pin: '15', index: 0},
    {id: 'SPARE2', label: 'S2', side: 'right', signal: 'digital', pin: '2', index: 1},
    // Analog RJ11 — bottom edge (no A0 on Maker ESP32)
    {id: 'A1', label: 'A1', side: 'bottom', signal: 'analog', pin: '32', index: 0},
    {id: 'A2', label: 'A2', side: 'bottom', signal: 'analog', pin: '34', index: 1},
    {id: 'A3', label: 'A3', side: 'bottom', signal: 'analog', pin: '35', index: 2}
];

/** Landscape toy-tile controller — roomy for kid hit targets. */
const BOARD = {x: 160, y: 110, w: 440, h: 280};
const JACK = {w: 30, h: 36};
const CARD = {w: 112, h: 38};
const STUB = 56;
const DEPTH = {x: 3, y: 10};

const extrudeFaces = (x, y, w, h, dx = DEPTH.x, dy = DEPTH.y) => ({
    bottom: `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w + dx} ${y + h + dy} L ${x + dx} ${y + h + dy} Z`,
    right: `M ${x + w} ${y} L ${x + w + dx} ${y + dy} L ${x + w + dx} ${y + h + dy} L ${x + w} ${y + h} Z`
});

const portById = id => PORTS.find(p => p.id === id) || null;

const isPortCompatible = (port, moduleDef) => {
    if (!port || !moduleDef) {
        return false;
    }
    return port.signal === moduleDef.signal;
};

const topBottomX = (index, count) => {
    const margin = 56;
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
    const step = count <= 1 ? 0 : 70;
    const y = BOARD.y + 70 + (port.index * step);
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
    extrudeFaces,
    portById,
    isPortCompatible,
    portPosition,
    cardCablePoint
};
