import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../../context/StudioContext.jsx';
import {SCENE} from '../../../domain/boardLayout';
import {moduleById} from '../../../domain/modules';
import {
    BOARD,
    PORTS,
    portById,
    portColor,
    portLinks,
    portPosition,
    portUiState,
    usedPortMap
} from '../../../domain/ports';
import {BoardDefs, BoardSurface} from '../BoardArt.jsx';
import ConnectionsLayer, {SceneDefs} from '../ConnectionsLayer.jsx';
import {UnplugButton, placeModule} from '../ModuleArt.jsx';
import {PortLabel} from '../Port.jsx';

import {Box, FaceSvg} from './Box.jsx';
import Jack3D from './Jack3D.jsx';
import Module3D, {MODULE_3D} from './Module3D.jsx';
import Parts3D, {ChipLegs} from './Parts3D.jsx';
import StageControls from './StageControls.jsx';
import {
    CENTER,
    IDLE_MS,
    MAX_TILT,
    PERSPECTIVE,
    VIEWS,
    ZMAX,
    ZMIN,
    clamp,
    prefersReducedMotion,
    unitScale
} from './view';

const SLAB_T = 7;

const edge = dir => `linear-gradient(${dir}, #f2f2ee 0 14%, #d7cca4 14% 86%, #f0f0ec 86%)`;

/** CSS 3D board: the fallback when WebGL isn't available. */
const Board3D = () => {
    const {
        connections,
        selectedModule,
        connectToPort,
        disconnect,
        flashPortId,
        clearSelection,
        wireHint,
        K
    } = useStudio();

    const stageRef = useRef(null);
    const sceneRef = useRef(null);
    const reducedRef = useRef(prefersReducedMotion());
    const viewRef = useRef({
        rx: 0,
        rz: 0,
        trx: VIEWS.v3d.rx,
        trz: VIEWS.v3d.rz,
        sway: 0,
        zoom: 1,
        panX: 0,
        panY: 0,
        lastUser: -1e9,
        dragging: false,
        viewKey: 'v3d'
    });
    const pointersRef = useRef(new Map());
    const downRef = useRef(null);
    const pinchRef = useRef(null);

    const [viewKey, setViewKey] = useState('v3d');
    const [zoomPct, setZoomPct] = useState(100);
    const [dragging, setDragging] = useState(false);

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;
    const usedPorts = useMemo(() => usedPortMap(connections), [connections]);
    const liveLinks = useMemo(() => portLinks(connections, K), [connections, K]);
    const modelled = useMemo(() => connections
        .filter(conn => MODULE_3D[conn.moduleId] && portById(conn.portId))
        .map(conn => {
            const port = portById(conn.portId);
            return {
                conn,
                placement: placeModule(
                    MODULE_3D[conn.moduleId],
                    port,
                    portPosition(port),
                    conn.offsetX || 0,
                    conn.offsetY || 0
                )
            };
        }), [connections]);

    const fit = useCallback(() => {
        const stage = stageRef.current;
        const scene = sceneRef.current;
        if (!stage || !scene) {
            return;
        }
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (w < 8 || h < 8) {
            return;
        }
        const v = viewRef.current;
        const u = unitScale(w, h, v.zoom);
        scene.style.setProperty('--u', `${u}px`);
        scene.style.left = `${(w / 2) + v.panX - (CENTER.x * u)}px`;
        scene.style.top = `${(h / 2) + v.panY - (CENTER.y * u)}px`;
        scene.style.transformOrigin = `${CENTER.x * u}px ${CENTER.y * u}px`;
        stage.style.perspective = `${PERSPECTIVE * u}px`;
    }, []);

    const clampPan = useCallback(() => {
        const stage = stageRef.current;
        const v = viewRef.current;
        const lim = Math.max(0, v.zoom - 0.6);
        v.panX = clamp(v.panX, -stage.clientWidth * lim, stage.clientWidth * lim);
        v.panY = clamp(v.panY, -stage.clientHeight * lim, stage.clientHeight * lim);
    }, []);

    const zoomAt = useCallback((factor, mx, my) => {
        const stage = stageRef.current;
        const v = viewRef.current;
        const next = clamp(v.zoom * factor, ZMIN, ZMAX);
        const ratio = next / v.zoom;
        if (ratio === 1) {
            return;
        }
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const cx = typeof mx === 'number' ? mx : w / 2;
        const cy = typeof my === 'number' ? my : h / 2;
        const px = (w / 2) + v.panX;
        const py = (h / 2) + v.panY;
        v.panX = cx - ((cx - px) * ratio) - (w / 2);
        v.panY = cy - ((cy - py) * ratio) - (h / 2);
        v.zoom = next;
        v.lastUser = performance.now();
        clampPan();
        fit();
        setZoomPct(Math.round(next * 100));
    }, [clampPan, fit]);

    const resetZoom = useCallback(() => {
        const v = viewRef.current;
        v.zoom = 1;
        v.panX = 0;
        v.panY = 0;
        fit();
        setZoomPct(100);
    }, [fit]);

    const chooseView = useCallback(key => {
        const v = viewRef.current;
        v.viewKey = key;
        setViewKey(key);
        if (key) {
            v.trx = VIEWS[key].rx;
            v.trz = VIEWS[key].rz;
            v.lastUser = performance.now();
            if (reducedRef.current) {
                v.rx = v.trx;
                v.rz = v.trz;
            }
        }
    }, []);

    // Eased rotation plus a slow idle sway, written straight to the scene so React doesn't re-render per frame.
    useEffect(() => {
        const v = viewRef.current;
        const reduced = reducedRef.current;
        if (reduced) {
            v.rx = v.trx;
            v.rz = v.trz;
        }
        let raf = 0;
        let last = performance.now();
        let t = 0;
        let applied = '';
        const frame = now => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            t += dt;
            if (!v.dragging) {
                const k = reduced ? 1 : 1 - Math.pow(0.0025, dt);
                v.rx += (v.trx - v.rx) * k;
                v.rz += (v.trz - v.rz) * k;
            }
            const idle = !reduced && !v.dragging && now - v.lastUser > IDLE_MS && v.viewKey !== 'vtop';
            v.sway += ((idle ? Math.sin(t * 0.35) * 9 : 0) - v.sway) * Math.min(1, dt * 1.5);
            const next = `rotateX(${v.rx.toFixed(2)}deg) rotateZ(${(v.rz + v.sway).toFixed(2)}deg)`;
            if (next !== applied && sceneRef.current) {
                sceneRef.current.style.transform = next;
                applied = next;
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        fit();
        if (!stage || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const ro = new ResizeObserver(fit);
        ro.observe(stage);
        return () => ro.disconnect();
    }, [fit]);

    // Wheel has to be a non-passive native listener so the page doesn't scroll while zooming.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) {
            return undefined;
        }
        const onWheel = event => {
            event.preventDefault();
            const rect = stage.getBoundingClientRect();
            const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
            zoomAt(Math.exp(-dy * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
        };
        stage.addEventListener('wheel', onWheel, {passive: false});
        return () => stage.removeEventListener('wheel', onWheel);
    }, [zoomAt]);

    const onPointerDown = useCallback(event => {
        if (event.target.closest && event.target.closest('[data-tb3d-ui]')) {
            return;
        }
        const stage = stageRef.current;
        const pts = pointersRef.current;
        pts.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (stage.setPointerCapture) {
            stage.setPointerCapture(event.pointerId);
        }
        if (pts.size === 2) {
            const [a, b] = Array.from(pts.values());
            pinchRef.current = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
            if (downRef.current) {
                downRef.current.moved = true;
            }
            return;
        }
        const v = viewRef.current;
        const jack = event.target.closest ? event.target.closest('[data-port]') : null;
        downRef.current = {
            x: event.clientX,
            y: event.clientY,
            rx: v.trx,
            rz: v.trz,
            px: v.panX,
            py: v.panY,
            pan: event.shiftKey || event.button === 1 || event.button === 2,
            moved: false,
            portId: jack ? jack.getAttribute('data-port') : null
        };
    }, []);

    const onPointerMove = useCallback(event => {
        const pts = pointersRef.current;
        if (!pts.has(event.pointerId)) {
            return;
        }
        pts.set(event.pointerId, {x: event.clientX, y: event.clientY});
        const v = viewRef.current;
        const pinch = pinchRef.current;
        if (pinch && pts.size >= 2) {
            const [a, b] = Array.from(pts.values());
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const rect = stageRef.current.getBoundingClientRect();
            v.panX += mx - pinch.mx;
            v.panY += my - pinch.my;
            zoomAt(d / pinch.d, mx - rect.left, my - rect.top);
            pinchRef.current = {d, mx, my};
            return;
        }
        const down = downRef.current;
        if (!down) {
            return;
        }
        const dx = event.clientX - down.x;
        const dy = event.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) {
            down.moved = true;
            v.dragging = true;
            setDragging(true);
            if (!down.pan) {
                chooseView(null);
            }
        }
        if (down.moved) {
            if (down.pan) {
                v.panX = down.px + dx;
                v.panY = down.py + dy;
                clampPan();
                fit();
            } else {
                v.trz = down.rz + (dx * 0.35);
                v.trx = clamp(down.rx - (dy * 0.3), 0, MAX_TILT);
                v.rx = v.trx;
                v.rz = v.trz;
            }
            v.lastUser = performance.now();
        }
    }, [chooseView, clampPan, fit, zoomAt]);

    const onPointerUp = useCallback(event => {
        const pts = pointersRef.current;
        pts.delete(event.pointerId);
        if (pts.size < 2) {
            pinchRef.current = null;
        }
        if (pts.size > 0) {
            return;
        }
        const down = downRef.current;
        downRef.current = null;
        const v = viewRef.current;
        v.dragging = false;
        v.lastUser = performance.now();
        setDragging(false);
        if (down && !down.moved) {
            if (down.portId) {
                connectToPort(down.portId);
            } else {
                clearSelection();
            }
        }
    }, [clearSelection, connectToPort]);

    return (
        <div
            ref={stageRef}
            className={dragging ? 'tb3d-stage tb3d-drag' : 'tb3d-stage'}
            style={{
                background: `radial-gradient(120% 90% at 50% 38%, ${K.canvasGlow} 0%, ${K.canvas} 72%)`,
                perspectiveOrigin: '50% 40%'
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={event => event.preventDefault()}
        >
            <div
                ref={sceneRef}
                className="tb3d-scene"
            >
                <div
                    className="tb3d-group"
                    style={{'--gx': BOARD.x, '--gy': BOARD.y}}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: 'calc(4 * var(--u))',
                            top: 'calc(10 * var(--u))',
                            width: `calc(${BOARD.w} * var(--u))`,
                            height: `calc(${BOARD.h} * var(--u))`,
                            background: 'rgba(0,0,0,0.34)',
                            borderRadius: 'calc(20 * var(--u))',
                            filter: 'blur(calc(14 * var(--u)))',
                            transform: `translateZ(calc(${-SLAB_T - 1.5} * var(--u)))`,
                            pointerEvents: 'none'
                        }}
                    />
                    <Box
                        x={0}
                        y={0}
                        w={BOARD.w}
                        d={BOARD.h}
                        h={SLAB_T}
                        z={-SLAB_T}
                        faces={{
                            t: {
                                radius: 'calc(10 * var(--u))',
                                content: (
                                    <FaceSvg w={BOARD.w} h={BOARD.h}>
                                        <BoardDefs />
                                        <BoardSurface connected={liveLinks} />
                                        <ChipLegs />
                                    </FaceSvg>
                                )
                            },
                            s: {bg: edge('180deg')},
                            n: {bg: edge('0deg')},
                            e: {bg: edge('90deg')},
                            w: {bg: edge('270deg')},
                            b: {bg: '#e9e9e4'}
                        }}
                    />
                    <Parts3D connected={liveLinks} />
                </div>

                {PORTS.map(port => (
                    <Jack3D
                        key={port.id}
                        port={port}
                        state={portUiState(port, usedPorts, selectedDef)}
                        flashing={flashPortId === port.id}
                        K={K}
                    />
                ))}

                {/* Labels, cables and modules lie flat at board-top height */}
                <div
                    className="tb3d-layer"
                    style={{
                        left: `calc(${SCENE.x} * var(--u))`,
                        top: `calc(${SCENE.y} * var(--u))`,
                        width: `calc(${SCENE.w} * var(--u))`,
                        height: `calc(${SCENE.h} * var(--u))`,
                        transform: 'translateZ(calc(0.6 * var(--u)))'
                    }}
                >
                    <svg viewBox={`${SCENE.x} ${SCENE.y} ${SCENE.w} ${SCENE.h}`}>
                        <SceneDefs />
                        {PORTS.map(port => {
                            const pos = portPosition(port);
                            const state = portUiState(port, usedPorts, selectedDef);
                            return (
                                <PortLabel
                                    key={port.id}
                                    port={port}
                                    x={pos.x}
                                    y={pos.y}
                                    color={portColor(port, K)}
                                    K={K}
                                    opacity={state.dimmed ? 0.3 : 1}
                                />
                            );
                        })}
                        <ConnectionsLayer
                            connections={connections}
                            disconnect={disconnect}
                            K={K}
                            models={MODULE_3D}
                        />
                    </svg>
                </div>

                {modelled.map(({conn, placement}) => (
                    <Module3D
                        key={conn.id}
                        moduleId={conn.moduleId}
                        placement={placement}
                        name={(moduleById(conn.moduleId) || {}).name}
                        floorZ={-SLAB_T - 1.5}
                    />
                ))}

                {/* Unplug badges float above the 3D modules so the parts never hide them */}
                <div
                    className="tb3d-layer"
                    style={{
                        left: `calc(${SCENE.x} * var(--u))`,
                        top: `calc(${SCENE.y} * var(--u))`,
                        width: `calc(${SCENE.w} * var(--u))`,
                        height: `calc(${SCENE.h} * var(--u))`,
                        transform: 'translateZ(calc(20 * var(--u)))'
                    }}
                >
                    <svg viewBox={`${SCENE.x} ${SCENE.y} ${SCENE.w} ${SCENE.h}`}>
                        <g style={{pointerEvents: 'auto'}}>
                            {modelled.map(({conn, placement}) => (
                                <UnplugButton
                                    key={conn.id}
                                    x={placement.cx + (placement.boxW / 2)}
                                    y={placement.cy - (placement.boxH / 2)}
                                    onDisconnect={() => disconnect(conn.id)}
                                    K={K}
                                />
                            ))}
                        </g>
                    </svg>
                </div>
            </div>

            <StageControls
                K={K}
                viewKey={viewKey}
                onView={chooseView}
                zoomPct={zoomPct}
                onZoom={zoomAt}
                onFit={resetZoom}
                wireHint={wireHint}
            />
        </div>
    );
};

export default Board3D;
