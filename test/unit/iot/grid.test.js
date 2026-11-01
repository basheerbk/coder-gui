import {
    GAP,
    ROW,
    clampSpan,
    colsForWidth,
    moveItem,
    normalizeWidget,
    sizeFromW,
    spanFromPointer,
    spanOf,
    targetIndexAt,
    tileHeight,
    typeDefaultSpan
} from '../../../src/iot/grid';
import {layoutProblem} from '../../../src/iot/widgetTypes';

describe('dashboard grid maths', () => {
    test('old S/M/L widgets get a span from their size and type', () => {
        expect(spanOf({type: 'chart', size: 'L'})).toEqual({w: 4, h: 4});
        expect(spanOf({type: 'value', size: 'S'})).toEqual({w: 1, h: 2});
        expect(spanOf({type: 'alerts', size: 'M'})).toEqual({w: 2, h: 3});
        expect(spanOf({type: 'gauge'})).toEqual({w: 2, h: 3});
    });

    test('explicit spans win and are kept in range', () => {
        expect(spanOf({type: 'value', size: 'L', w: 1, h: 3})).toEqual({w: 1, h: 3});
        expect(spanOf({type: 'value', w: 99, h: 99})).toEqual({w: 4, h: 6});
        expect(spanOf({type: 'value', w: 0, h: 0})).toEqual({w: 1, h: 1});
        expect(spanOf({type: 'value', w: 2})).toEqual({w: 2, h: 2}); // only half a span: fall back
    });

    test('normalizeWidget always carries w, h and a matching size', () => {
        const w = normalizeWidget({id: 'a', type: 'chart', size: 'L'});
        expect([w.w, w.h, w.size]).toEqual([4, 4, 'L']);
        expect(normalizeWidget({id: 'b', type: 'value', w: 2, h: 2, size: 'S'}).size).toBe('M');
        expect(sizeFromW(1)).toBe('S');
        expect(sizeFromW(3)).toBe('L');
    });

    test('each type keeps a minimum size and a default for new widgets', () => {
        expect(clampSpan('chart', 1, 1)).toEqual({w: 2, h: 3});
        expect(clampSpan('gauge', 1, 1)).toEqual({w: 1, h: 3});
        expect(clampSpan('value', 9, 9)).toEqual({w: 4, h: 6});
        expect(clampSpan('chart', 4, 4, 2)).toEqual({w: 2, h: 4}); // phone has two columns
        expect(typeDefaultSpan('chart')).toEqual({w: 4, h: 4});
        expect(typeDefaultSpan('switch')).toEqual({w: 1, h: 2});
    });

    test('columns follow the available width, never fewer than two', () => {
        expect(colsForWidth(0)).toBe(4);
        expect(colsForWidth(320)).toBe(2);
        expect(colsForWidth(600)).toBe(3);
        expect(colsForWidth(1000)).toBe(4);
    });

    test('moveItem reorders without mutating and ignores bad indexes', () => {
        const list = ['a', 'b', 'c', 'd'];
        expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
        expect(list).toEqual(['a', 'b', 'c', 'd']);
        expect(moveItem(list, 1, 1)).toBe(list);
        expect(moveItem(list, 1, 9)).toBe(list);
        expect(moveItem(list, -1, 2)).toBe(list);
    });

    test('dragging over the middle of another tile moves there; edges and gaps do not', () => {
        const rects = [
            {x: 0, y: 0, w: 100, h: 100},
            {x: 112, y: 0, w: 100, h: 100},
            {x: 224, y: 0, w: 100, h: 100}
        ];
        expect(targetIndexAt(rects, 160, 50, 0)).toBe(1);
        expect(targetIndexAt(rects, 270, 50, 0)).toBe(2);
        expect(targetIndexAt(rects, 116, 50, 0)).toBe(0); // on the edge of tile 1: stay (no flicker)
        expect(targetIndexAt(rects, 106, 50, 0)).toBe(0); // in the gap: stay
        expect(targetIndexAt(rects, 50, 50, 0)).toBe(0); // over itself: stay
        expect(targetIndexAt(rects, 50, 400, 0)).toBe(2); // below everything: to the end
    });

    test('resizing snaps to whole tiles and respects the grid', () => {
        const colW = 100;
        const base = {left: 0, top: 0, colW, cols: 4};
        // The pointer exactly at the far corner of a 2x3 tile.
        expect(spanFromPointer(Object.assign({px: (2 * colW) + GAP, py: (3 * ROW) + (2 * GAP)}, base))).toEqual({w: 2, h: 3});
        expect(spanFromPointer(Object.assign({px: 5, py: 5}, base))).toEqual({w: 1, h: 1});
        expect(spanFromPointer(Object.assign({px: 9999, py: 9999}, base))).toEqual({w: 4, h: 6});
        expect(spanFromPointer(Object.assign({px: 9999, py: 9999}, base, {cols: 2}))).toEqual({w: 2, h: 6});
        expect(tileHeight(1)).toBe(ROW);
        expect(tileHeight(3)).toBe((3 * ROW) + (2 * GAP));
    });
});

describe('layout problems shown before Save', () => {
    test('readings need a name and gauges need a sensible range', () => {
        expect(layoutProblem([{type: 'value', key: 'temperature', options: {}}])).toBeNull();
        expect(layoutProblem([{type: 'value', key: '', title: 'T', options: {}}])).toMatch(/needs a reading/);
        expect(layoutProblem([{type: 'gauge', key: 'x', options: {min: 5, max: 5}}])).toMatch(/Min must be below Max/);
        expect(layoutProblem([{type: 'nope'}])).toMatch(/Unknown/);
    });
});
