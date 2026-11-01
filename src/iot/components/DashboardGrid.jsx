import React, {useRef, useState} from 'react';

import {prettyKey} from '../format';
import {
    GAP,
    ROW,
    clampSpan,
    moveItem,
    sizeFromW,
    spanFromPointer,
    spanOf,
    targetIndexAt
} from '../grid';
import {useTheme} from '../ui.jsx';

const DRAG_START_PX = 6;

const GripIcon = ({color}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {[3, 7, 11].map(x => [3, 7, 11].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill={color} />))}
    </svg>
);

const ResizeIcon = ({color}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M12 5 L5 12 M12 9 L9 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
);

/**
 * The widget grid. Not editing: a plain responsive grid. Editing: tiles can be dragged to a new
 * place, resized from the corner, and tapped to open their settings. Touch users drag from the grip
 * (so the page can still scroll); mouse users can drag from anywhere on a tile. Keyboard: arrows
 * move, Shift+arrows resize, Enter opens settings.
 */
const DashboardGrid = ({widgets, cols, editing, selectedId, onSelect, onChange, renderBody}) => {
    const K = useTheme();
    const gridRef = useRef(null);
    const tileRefs = useRef({});
    const widgetsRef = useRef(widgets);
    widgetsRef.current = widgets;
    const [drag, setDrag] = useState(null);
    const [resizing, setResizing] = useState(null);
    // A drag or resize ends with a click on some tile; that must not count as a tap.
    const suppressClick = useRef(false);
    const holdClicks = () => {
        suppressClick.current = true;
        window.setTimeout(() => {
            suppressClick.current = false;
        }, 80);
    };

    const gridPoint = ev => {
        const rect = gridRef.current.getBoundingClientRect();
        return {px: ev.clientX - rect.left, py: ev.clientY - rect.top};
    };

    const autoScroll = ev => {
        if (ev.clientY < 70) {
            window.scrollBy(0, -14);
        } else if (ev.clientY > window.innerHeight - 70) {
            window.scrollBy(0, 14);
        }
    };

    const track = (onMove, onEnd) => {
        const move = ev => onMove(ev);
        const up = ev => {
            cleanup();
            onEnd(ev, false);
        };
        const cancel = ev => {
            cleanup();
            onEnd(ev, true);
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', cancel);
        };
        window.addEventListener('pointermove', move, {passive: false});
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
    };

    const startDrag = (e, id, viaGrip) => {
        if (!editing || (e.button !== undefined && e.button > 0)) {
            return;
        }
        const el = tileRefs.current[id];
        if (!el) {
            return;
        }
        const canDrag = viaGrip || e.pointerType !== 'touch';
        const startX = e.clientX;
        const startY = e.clientY;
        const start = gridPoint(e);
        const grabX = start.px - el.offsetLeft;
        const grabY = start.py - el.offsetTop;
        let moved = false;
        track(ev => {
            if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_START_PX) {
                return;
            }
            moved = true;
            if (!canDrag) {
                return;
            }
            ev.preventDefault();
            autoScroll(ev);
            const {px, py} = gridPoint(ev);
            setDrag({id, dx: px - grabX - el.offsetLeft, dy: py - grabY - el.offsetTop});
            const list = widgetsRef.current;
            const from = list.findIndex(w => w.id === id);
            const rects = list.map(w => {
                const t = tileRefs.current[w.id];
                return t ? {x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight} : null;
            });
            const to = targetIndexAt(rects, px, py, from);
            if (to !== from) {
                onChange(moveItem(list, from, to));
            }
        }, (ev, cancelled) => {
            setDrag(null);
            if (moved) {
                holdClicks();
            } else if (!cancelled) {
                onSelect(id);
            }
        });
        if (!canDrag) {
            return;
        }
        e.preventDefault();
    };

    const startResize = (e, id) => {
        if (!editing || (e.button !== undefined && e.button > 0)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const el = tileRefs.current[id];
        const grid = gridRef.current;
        if (!el || !grid) {
            return;
        }
        setResizing(id);
        onSelect(id);
        track(ev => {
            ev.preventDefault();
            autoScroll(ev);
            const {px, py} = gridPoint(ev);
            const colW = (grid.clientWidth - (GAP * (cols - 1))) / cols;
            const want = spanFromPointer({px, py, left: el.offsetLeft, top: el.offsetTop, colW, cols});
            const list = widgetsRef.current;
            const current = list.find(w => w.id === id);
            if (!current) {
                return;
            }
            const next = clampSpan(current.type, want.w, want.h, cols);
            if (next.w !== current.w || next.h !== current.h) {
                onChange(list.map(w => (w.id === id ?
                    Object.assign({}, w, next, {size: sizeFromW(next.w)}) : w)));
            }
        }, () => {
            setResizing(null);
            holdClicks();
        });
    };

    const onKeyDown = (e, widget, index) => {
        if (!editing || e.target !== e.currentTarget) {
            return;
        }
        const key = e.key;
        const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (key === 'Enter' || key === ' ') {
            e.preventDefault();
            onSelect(widget.id);
            return;
        }
        if (arrows.indexOf(key) < 0) {
            return;
        }
        e.preventDefault();
        if (e.shiftKey) {
            const span = spanOf(widget);
            const dw = key === 'ArrowRight' ? 1 : (key === 'ArrowLeft' ? -1 : 0);
            const dh = key === 'ArrowDown' ? 1 : (key === 'ArrowUp' ? -1 : 0);
            const next = clampSpan(widget.type, span.w + dw, span.h + dh, cols);
            onChange(widgets.map(w => (w.id === widget.id ?
                Object.assign({}, w, next, {size: sizeFromW(next.w)}) : w)));
            return;
        }
        const to = index + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1);
        onChange(moveItem(widgets, index, to));
        // The tile re-mounts nothing (stable keys); keep keyboard focus on it after the reorder.
        window.setTimeout(() => {
            const t = tileRefs.current[widget.id];
            if (t) {
                t.focus();
            }
        }, 0);
    };

    return (
        <div style={{minWidth: 0}}>
            <div
                ref={gridRef}
                style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridAutoRows: ROW,
                    gridAutoFlow: 'row dense',
                    gap: GAP
                }}
            >
                {widgets.map((w, index) => {
                    const span = spanOf(w);
                    const selected = editing && selectedId === w.id;
                    const dragging = drag && drag.id === w.id;
                    const title = w.title || prettyKey(w.key) || w.type;
                    return (
                        <div
                            key={w.id}
                            ref={el => {
                                if (el) {
                                    tileRefs.current[w.id] = el;
                                } else {
                                    delete tileRefs.current[w.id];
                                }
                            }}
                            role={editing ? 'button' : undefined}
                            tabIndex={editing ? 0 : undefined}
                            aria-label={editing ?
                                `${title}. Enter to edit, arrow keys to move, Shift with arrows to resize.` : undefined}
                            aria-pressed={editing ? Boolean(selected) : undefined}
                            onKeyDown={editing ? e => onKeyDown(e, w, index) : undefined}
                            style={{
                                position: 'relative',
                                gridColumn: `span ${Math.min(cols, span.w)}`,
                                gridRow: `span ${span.h}`,
                                display: 'flex',
                                flexDirection: 'column',
                                boxSizing: 'border-box',
                                minWidth: 0,
                                minHeight: 0,
                                overflow: 'hidden',
                                padding: 14,
                                background: K.panel,
                                border: `1px ${editing && !selected ? 'dashed' : 'solid'} ${selected ? K.accent : K.border}`,
                                boxShadow: selected ? `0 0 0 2px ${K.accent}` : (dragging ? '0 12px 28px rgba(0,0,0,0.35)' : 'none'),
                                borderRadius: 14,
                                outline: 'none',
                                zIndex: dragging || resizing === w.id ? 5 : 'auto',
                                opacity: dragging ? 0.92 : 1,
                                transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : 'none',
                                transition: dragging || resizing ? 'none' : 'box-shadow 0.15s'
                            }}
                        >
                            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0}}>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: K.muted,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {title}
                                </div>
                                {editing ? (
                                    <span
                                        onPointerDown={e => startDrag(e, w.id, true)}
                                        title="Drag to move"
                                        style={{
                                            position: 'relative',
                                            zIndex: 2,
                                            touchAction: 'none',
                                            cursor: 'grab',
                                            padding: 6,
                                            margin: -6,
                                            display: 'flex'
                                        }}
                                    >
                                        <GripIcon color={K.dim} />
                                    </span>
                                ) : null}
                            </div>
                            <div
                                aria-hidden={editing ? 'true' : undefined}
                                inert={editing ? '' : undefined}
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflowY: editing ? 'hidden' : 'auto',
                                    overflowX: 'hidden'
                                }}
                            >
                                {renderBody(w)}
                            </div>
                            {editing ? (
                                <React.Fragment>
                                    <div
                                        onPointerDown={e => startDrag(e, w.id, false)}
                                        onClick={() => {
                                            if (!suppressClick.current) {
                                                onSelect(w.id);
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            right: 0,
                                            bottom: 0,
                                            cursor: dragging ? 'grabbing' : 'grab',
                                            touchAction: 'pan-y'
                                        }}
                                    />
                                    <span
                                        onPointerDown={e => startResize(e, w.id)}
                                        title="Drag to resize"
                                        style={{
                                            position: 'absolute',
                                            zIndex: 2,
                                            right: 2,
                                            bottom: 2,
                                            padding: 6,
                                            cursor: 'nwse-resize',
                                            touchAction: 'none',
                                            display: 'flex'
                                        }}
                                    >
                                        <ResizeIcon color={selected ? K.accent : K.dim} />
                                    </span>
                                </React.Fragment>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DashboardGrid;
