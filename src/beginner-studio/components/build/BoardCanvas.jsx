import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {moduleById} from '../../domain/modules';
import {PORTS, SPARE_JACKS, portLinks, portPosition, portUiState, usedPortMap} from '../../domain/ports';
import {SCENE} from '../../domain/boardLayout';

import BoardArt from './BoardArt.jsx';
import ConnectionsLayer, {SceneDefs} from './ConnectionsLayer.jsx';
import Port, {SpareJack} from './Port.jsx';

/** Screen pixels per world unit: the scene fills the canvas, within limits. */
const fitScale = (w, h) => Math.max(0.7, Math.min(1.8, Math.min(w / SCENE.w, h / SCENE.h)));

/** Zoom is relative to the fitted scale: 1 = fit. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.2;
const clampZoom = z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

const centeredPan = (w, h, zoom = 1) => {
    const s = fitScale(w, h) * zoom;
    return {
        x: (((w / s) - SCENE.w) / 2) - SCENE.x,
        y: (((h / s) - SCENE.h) / 2) - SCENE.y
    };
};

const clientToSvg = (svg, clientX, clientY) => {
    if (!svg) {
        return {x: 0, y: 0};
    }
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    if (!rect.width || !rect.height || !vb.width || !vb.height) {
        return {x: 0, y: 0};
    }
    return {
        x: ((clientX - rect.left) / rect.width) * vb.width + vb.x,
        y: ((clientY - rect.top) / rect.height) * vb.height + vb.y
    };
};

const BoardCanvas = () => {
    const {
        connections,
        selectedModule,
        connectToPort,
        disconnect,
        flashPortId,
        clearSelection,
        moveConnection,
        bendConnection,
        wireHint,
        K
    } = useStudio();

    const wrapRef = useRef(null);
    const svgRef = useRef(null);
    const panRef = useRef({x: 0, y: 0});
    const dragRef = useRef(null);
    const userMovedRef = useRef(false);
    const skipClickRef = useRef(false);

    const zoomRef = useRef(1);
    const sizeRef = useRef({w: 800, h: 520});

    const [size, setSize] = useState({w: 800, h: 520});
    const [pan, setPan] = useState({x: 0, y: 0});
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [dragModule, setDragModule] = useState(null);
    const [dragBend, setDragBend] = useState(null);

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;
    const scale = fitScale(size.w, size.h) * zoom;
    const usedPorts = useMemo(() => usedPortMap(connections), [connections]);
    const liveLinks = useMemo(() => portLinks(connections, K), [connections, K]);

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    /** Zoom keeping the world point under (sx, sy) — canvas pixels, default centre — in place. */
    const zoomTo = useCallback((nextZoom, sx, sy) => {
        const {w, h} = sizeRef.current;
        const z = clampZoom(nextZoom);
        const oldScale = fitScale(w, h) * zoomRef.current;
        const newScale = fitScale(w, h) * z;
        const ax = typeof sx === 'number' ? sx : w / 2;
        const ay = typeof sy === 'number' ? sy : h / 2;
        const p = panRef.current;
        const next = {
            x: (ax / newScale) - ((ax / oldScale) - p.x),
            y: (ay / newScale) - ((ay / oldScale) - p.y)
        };
        zoomRef.current = z;
        panRef.current = next;
        userMovedRef.current = true;
        setZoom(z);
        setPan(next);
    }, []);

    const zoomIn = useCallback(() => zoomTo(zoomRef.current * ZOOM_STEP), [zoomTo]);
    const zoomOut = useCallback(() => zoomTo(zoomRef.current / ZOOM_STEP), [zoomTo]);
    const zoomFit = useCallback(() => {
        const {w, h} = sizeRef.current;
        const centered = centeredPan(w, h, 1);
        zoomRef.current = 1;
        panRef.current = centered;
        userMovedRef.current = false;
        setZoom(1);
        setPan(centered);
    }, []);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) {
            return undefined;
        }
        // Non-passive so the page does not scroll while zooming the board.
        const onWheel = event => {
            event.preventDefault();
            const rect = el.getBoundingClientRect();
            const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
            zoomTo(zoomRef.current * factor, event.clientX - rect.left, event.clientY - rect.top);
        };
        el.addEventListener('wheel', onWheel, {passive: false});
        return () => el.removeEventListener('wheel', onWheel);
    }, [zoomTo]);

    useEffect(() => {
        const onKey = event => {
            const t = event.target;
            if (event.ctrlKey || event.metaKey || event.altKey ||
                (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
                return;
            }
            if (event.key === '+' || event.key === '=') {
                zoomIn();
            } else if (event.key === '-' || event.key === '_') {
                zoomOut();
            } else if (event.key === '0') {
                zoomFit();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [zoomIn, zoomOut, zoomFit]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const apply = () => {
            const next = {w: el.clientWidth, h: el.clientHeight};
            if (next.w < 8 || next.h < 8) {
                return;
            }
            sizeRef.current = next;
            setSize(next);
            if (!userMovedRef.current) {
                const centered = centeredPan(next.w, next.h, zoomRef.current);
                panRef.current = centered;
                setPan(centered);
            }
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const onPointerDown = useCallback(event => {
        if (event.button !== 0) {
            return;
        }
        const svg = svgRef.current;
        const point = clientToSvg(svg, event.clientX, event.clientY);
        dragRef.current = {
            kind: 'pan',
            startX: point.x,
            startY: point.y,
            panX: panRef.current.x,
            panY: panRef.current.y,
            moved: false
        };
        setDragging(true);
        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }, []);

    const startBendDrag = useCallback((event, conn, handleX, handleY) => {
        const svg = svgRef.current;
        const point = clientToSvg(svg, event.clientX, event.clientY);
        dragRef.current = {
            kind: 'bend',
            id: conn.id,
            startX: point.x,
            startY: point.y,
            originX: handleX,
            originY: handleY,
            moved: false
        };
        setDragBend({id: conn.id, x: handleX, y: handleY});
        setDragging(true);
        if (svg && svg.setPointerCapture) {
            svg.setPointerCapture(event.pointerId);
        }
    }, []);

    const startModuleDrag = useCallback((event, conn) => {
        const svg = svgRef.current;
        const point = clientToSvg(svg, event.clientX, event.clientY);
        const originX = conn.offsetX || 0;
        const originY = conn.offsetY || 0;
        dragRef.current = {
            kind: 'module',
            id: conn.id,
            startX: point.x,
            startY: point.y,
            originX,
            originY,
            moved: false
        };
        setDragModule({id: conn.id, x: originX, y: originY});
        setDragging(true);
        if (svg && svg.setPointerCapture) {
            svg.setPointerCapture(event.pointerId);
        }
    }, []);

    const onPointerMove = useCallback(event => {
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        const point = clientToSvg(svgRef.current, event.clientX, event.clientY);
        const dx = point.x - drag.startX;
        const dy = point.y - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            drag.moved = true;
            if (drag.kind === 'pan') {
                userMovedRef.current = true;
            }
        }
        if (drag.kind === 'module') {
            setDragModule({id: drag.id, x: drag.originX + dx, y: drag.originY + dy});
            return;
        }
        if (drag.kind === 'bend') {
            setDragBend({id: drag.id, x: drag.originX + dx, y: drag.originY + dy});
            return;
        }
        const next = {x: drag.panX + dx, y: drag.panY + dy};
        panRef.current = next;
        setPan(next);
    }, []);

    const onPointerUp = useCallback(event => {
        const drag = dragRef.current;
        dragRef.current = null;
        setDragging(false);
        if (event.currentTarget.releasePointerCapture && event.currentTarget.hasPointerCapture) {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
        if (drag && drag.kind === 'module') {
            const point = clientToSvg(svgRef.current, event.clientX, event.clientY);
            const dx = point.x - drag.startX;
            const dy = point.y - drag.startY;
            moveConnection(drag.id, drag.originX + dx, drag.originY + dy);
            setDragModule(null);
            setDragBend(null);
            skipClickRef.current = true;
            return;
        }
        if (drag && drag.kind === 'bend') {
            const point = clientToSvg(svgRef.current, event.clientX, event.clientY);
            const dx = point.x - drag.startX;
            const dy = point.y - drag.startY;
            bendConnection(drag.id, drag.originX + dx, drag.originY + dy);
            setDragBend(null);
            skipClickRef.current = true;
            return;
        }
        setDragModule(null);
        setDragBend(null);
        if (drag && drag.moved) {
            skipClickRef.current = true;
        }
    }, [moveConnection, bendConnection]);

    const onClick = useCallback(() => {
        if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
        }
        clearSelection();
    }, [clearSelection]);

    return (
        <div
            ref={wrapRef}
            style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: K.canvas,
                backgroundImage: [
                    `radial-gradient(ellipse at 50% 40%, ${K.canvasGlow} 0%, transparent 70%)`,
                    `radial-gradient(circle, ${K.gridDot} 1px, transparent 1.4px)`
                ].join(', '),
                backgroundSize: 'auto, 18px 18px',
                cursor: dragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none'
            }}
            onClick={onClick}
        >
            {wireHint ? (
                <div
                    role="status"
                    style={{
                        position: 'absolute',
                        top: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2,
                        maxWidth: '90%',
                        background: K.panel,
                        color: K.text,
                        border: `1px solid ${K.orange}`,
                        borderRadius: 10,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        pointerEvents: 'none'
                    }}
                >
                    {wireHint}
                </div>
            ) : null}
            <svg
                ref={svgRef}
                viewBox={`0 0 ${size.w / scale} ${size.h / scale}`}
                preserveAspectRatio="none"
                style={{width: '100%', height: '100%', display: 'block'}}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                <SceneDefs />

                <g transform={`translate(${pan.x}, ${pan.y})`}>
                    <BoardArt connected={liveLinks} />
                    {SPARE_JACKS.map(jack => <SpareJack key={jack.id} jack={jack} />)}

                    {PORTS.map(port => {
                        const state = portUiState(port, usedPorts, selectedDef);
                        return (
                            <Port
                                key={port.id}
                                port={port}
                                pos={portPosition(port)}
                                occupied={state.occupied}
                                compatible={state.compatible}
                                dimmed={state.dimmed}
                                cloudLocked={state.cloudLocked}
                                flashing={flashPortId === port.id}
                                onClick={() => {
                                    connectToPort(port.id);
                                }}
                            />
                        );
                    })}

                    <ConnectionsLayer
                        connections={connections}
                        disconnect={disconnect}
                        K={K}
                        dragModule={dragModule}
                        dragBend={dragBend}
                        onBendStart={startBendDrag}
                        onModuleMoveStart={startModuleDrag}
                    />
                </g>
            </svg>
            <ZoomControls
                K={K}
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onFit={zoomFit}
            />
        </div>
    );
};

const ZoomButton = ({K, label, title, disabled, onClick, children, wide}) => (
    <button
        type="button"
        aria-label={label}
        title={title}
        disabled={disabled}
        onClick={onClick}
        style={{
            font: 'inherit',
            fontSize: wide ? 11 : 18,
            fontWeight: 700,
            lineHeight: 1,
            minWidth: wide ? 48 : 32,
            height: 32,
            padding: wide ? '0 6px' : 0,
            borderRadius: 8,
            border: 0,
            background: 'transparent',
            color: K.text,
            opacity: disabled ? 0.35 : 1,
            cursor: disabled ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}
    >
        {children}
    </button>
);

const ICON_PROPS = {
    'width': 16,
    'height': 16,
    'viewBox': '0 0 16 16',
    'fill': 'none',
    'stroke': 'currentColor',
    'strokeWidth': 1.8,
    'strokeLinecap': 'round',
    'strokeLinejoin': 'round',
    'aria-hidden': true
};

// Clicks and drags on the toolbar must not pan the board or clear the selection.
const stopEvent = event => event.stopPropagation();

const ZoomControls = ({K, zoom, onZoomIn, onZoomOut, onFit}) => {
    const iconProps = ICON_PROPS;
    return (
        <div
            role="toolbar"
            aria-label="Zoom"
            onClick={stopEvent}
            onPointerDown={stopEvent}
            style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: 3,
                background: K.panel,
                border: `1px solid ${K.border}`,
                borderRadius: 10,
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                cursor: 'default'
            }}
        >
            <ZoomButton
                K={K}
                label="Zoom out"
                title="Zoom out (−)"
                disabled={zoom <= ZOOM_MIN + 1e-3}
                onClick={onZoomOut}
            >
                <svg {...iconProps}><path d="M3.5 8h9" /></svg>
            </ZoomButton>
            <ZoomButton
                wide
                K={K}
                label="Reset zoom"
                title="Reset zoom (0)"
                onClick={onFit}
            >
                {`${Math.round(zoom * 100)}%`}
            </ZoomButton>
            <ZoomButton
                K={K}
                label="Zoom in"
                title="Zoom in (+)"
                disabled={zoom >= ZOOM_MAX - 1e-3}
                onClick={onZoomIn}
            >
                <svg {...iconProps}><path d="M3.5 8h9M8 3.5v9" /></svg>
            </ZoomButton>
            <div style={{width: 1, height: 20, background: K.border, margin: '0 2px'}} />
            <ZoomButton
                K={K}
                label="Fit board to screen"
                title="Fit to screen (0)"
                onClick={onFit}
            >
                <svg {...iconProps}>
                    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
                </svg>
            </ZoomButton>
        </div>
    );
};

export default BoardCanvas;
