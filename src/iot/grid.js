/**
 * Dashboard grid maths. Widgets live in a flowing CSS grid (not free x/y), so the same layout
 * works on a phone (2 columns) and a desktop (4 columns). Each widget has a width `w` in
 * columns and a height `h` in rows; order decides where it lands. Everything here is pure so
 * it can be unit-tested without a browser.
 */

const ROW = 64;
const GAP = 12;
const MAX_COLS = 4;
const MAX_ROWS = 6;

const SIZE_W = {S: 1, M: 2, L: 4};
const DEFAULT_H = {value: 2, gauge: 3, chart: 4, switch: 2, slider: 2, status: 2, alerts: 3};
const MIN_SPAN = {
    value: {w: 1, h: 2},
    gauge: {w: 1, h: 3},
    chart: {w: 2, h: 3},
    switch: {w: 1, h: 2},
    slider: {w: 1, h: 2},
    status: {w: 1, h: 2},
    alerts: {w: 2, h: 2}
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Span for dashboards saved before widgets had w/h (they only had S/M/L). */
const defaultSpan = (type, size) => ({w: SIZE_W[size] || 2, h: DEFAULT_H[type] || 2});

/** Span for a widget added or re-styled in the editor. */
const typeDefaultSpan = type => ({w: type === 'chart' ? 4 : (type === 'alerts' ? 2 : 1), h: DEFAULT_H[type] || 2});

const spanOf = widget => {
    if (Number.isInteger(widget.w) && Number.isInteger(widget.h)) {
        return {w: clamp(widget.w, 1, MAX_COLS), h: clamp(widget.h, 1, MAX_ROWS)};
    }
    return defaultSpan(widget.type, widget.size);
};

const sizeFromW = w => (w <= 1 ? 'S' : (w === 2 ? 'M' : 'L'));

/** Always carries w, h and a matching legacy size, so the server and old readers agree. */
const normalizeWidget = widget => {
    const span = spanOf(widget);
    return Object.assign({}, widget, span, {size: sizeFromW(span.w)});
};

const minSpan = type => MIN_SPAN[type] || {w: 1, h: 2};

/** Keep a span inside what the widget can show and what the screen has. */
const clampSpan = (type, w, h, cols = MAX_COLS) => {
    const min = minSpan(type);
    return {
        w: clamp(w, min.w, Math.max(min.w, Math.min(cols, MAX_COLS))),
        h: clamp(h, min.h, MAX_ROWS)
    };
};

/** Pixel height of a tile that spans h rows. */
const tileHeight = h => (h * ROW) + ((h - 1) * GAP);

const colsForWidth = width => {
    if (!width) {
        return MAX_COLS;
    }
    if (width < 480) {
        return 2;
    }
    return width < 720 ? 3 : MAX_COLS;
};

const moveItem = (list, from, to) => {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
        return list;
    }
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
};

/**
 * Where should the dragged tile go? `rects` are the tiles' layout boxes (x, y, w, h) relative to
 * the grid. Only the middle of a tile counts, so a pointer sitting on a boundary does not make
 * tiles swap back and forth. Below everything means "to the end".
 */
const targetIndexAt = (rects, px, py, from) => {
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r || i === from) {
            continue;
        }
        const mx = r.w * 0.2;
        const my = r.h * 0.2;
        if (px >= r.x + mx && px <= r.x + r.w - mx && py >= r.y + my && py <= r.y + r.h - my) {
            return i;
        }
    }
    let bottom = 0;
    rects.forEach(r => {
        if (r) {
            bottom = Math.max(bottom, r.y + r.h);
        }
    });
    return py > bottom ? rects.length - 1 : from;
};

/** New span while the resize corner is dragged to pointer position (px, py) inside the grid. */
const spanFromPointer = ({px, py, left, top, colW, cols}) => ({
    w: clamp(Math.round((px - left + GAP) / (colW + GAP)), 1, cols),
    h: clamp(Math.round((py - top + GAP) / (ROW + GAP)), 1, MAX_ROWS)
});

export {
    GAP,
    MAX_COLS,
    MAX_ROWS,
    ROW,
    clampSpan,
    colsForWidth,
    defaultSpan,
    minSpan,
    moveItem,
    normalizeWidget,
    sizeFromW,
    spanFromPointer,
    spanOf,
    targetIndexAt,
    tileHeight,
    typeDefaultSpan
};
