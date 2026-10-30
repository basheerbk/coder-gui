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

const centeredPan = (w, h) => {
    const s = fitScale(w, h);
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

    const [size, setSize] = useState({w: 800, h: 520});
    const [pan, setPan] = useState({x: 0, y: 0});
    const [dragging, setDragging] = useState(false);
    const [dragModule, setDragModule] = useState(null);
    const [dragBend, setDragBend] = useState(null);

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;
    const scale = fitScale(size.w, size.h);
    const usedPorts = useMemo(() => usedPortMap(connections), [connections]);
    const liveLinks = useMemo(() => portLinks(connections, K), [connections, K]);

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

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
            setSize(next);
            if (!userMovedRef.current) {
                const centered = centeredPan(next.w, next.h);
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
        </div>
    );
};

export default BoardCanvas;
