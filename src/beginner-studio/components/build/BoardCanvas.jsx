import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {moduleById} from '../../domain/modules';
import {BOARD, DEPTH, PORTS, cardCablePoint, isPortCompatible, portPosition} from '../../domain/ports';

import ConnectedModuleCard from './ConnectedModuleCard.jsx';
import Port from './Port.jsx';
import Rj11Cable from './Rj11Cable.jsx';

const SCENE = {x: -50, y: -90, w: 940, h: 640};

const centeredPan = (w, h) => ({
    x: ((w - SCENE.w) / 2) - SCENE.x,
    y: ((h - SCENE.h) / 2) - SCENE.y
});

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
    const usedPorts = useMemo(() => {
        const map = {};
        connections.forEach(c => {
            map[c.portId] = c;
        });
        return map;
    }, [connections]);

    const cx = BOARD.x + (BOARD.w / 2);

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
                viewBox={`0 0 ${size.w} ${size.h}`}
                preserveAspectRatio="none"
                style={{width: '100%', height: '100%', display: 'block'}}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                <defs>
                    <filter id="cardShadow" x="-30%" y="-30%" width="170%" height="180%">
                        <feDropShadow dx="1" dy="8" stdDeviation="5" floodOpacity="0.4" />
                    </filter>
                    <filter id="boardShadow" x="-18%" y="-12%" width="140%" height="145%">
                        <feDropShadow dx="2" dy="18" stdDeviation="16" floodOpacity="0.48" />
                    </filter>
                    <filter id="chipShadow" x="-25%" y="-20%" width="160%" height="170%">
                        <feDropShadow dx="1" dy="5" stdDeviation="3" floodOpacity="0.45" />
                    </filter>
                    <filter id="socketPop" x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow dx="1" dy="3" stdDeviation="2.2" floodOpacity="0.55" />
                    </filter>
                    <filter id="plugPop" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="1" dy="2" stdDeviation="1.8" floodOpacity="0.5" />
                    </filter>
                    <filter id="cableGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.2" result="b" />
                        <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="pcbGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={K.pcbL} />
                        <stop offset="55%" stopColor={K.pcb} />
                        <stop offset="100%" stopColor={K.pcbB} />
                    </linearGradient>
                    <linearGradient id="pcbEdge" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#2e1065" stopOpacity="0.95" />
                    </linearGradient>
                    <linearGradient id="espShield" x1="0" y1="0" x2="0.15" y2="1">
                        <stop offset="0%" stopColor="#f1f5f9" />
                        <stop offset="22%" stopColor="#cbd5e1" />
                        <stop offset="55%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                    <linearGradient id="espAntenna" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <linearGradient id="espPad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fcd34d" />
                        <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id="faceHighlight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                        <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g transform={`translate(${pan.x}, ${pan.y})`}>
                    <g
                        transform={`translate(${cx}, ${BOARD.y + (BOARD.h / 2)}) scale(1, 0.92) translate(${-cx}, ${-(BOARD.y + (BOARD.h / 2))})`}
                    >
                    {(() => {
                        const boardR = 28;
                        return (
                            <g>
                                {/* Soft curved extrusion (matches rounded face) */}
                                <rect
                                    x={BOARD.x + DEPTH.x}
                                    y={BOARD.y + DEPTH.y}
                                    width={BOARD.w}
                                    height={BOARD.h}
                                    rx={boardR}
                                    fill="#2e1065"
                                    opacity={0.92}
                                />
                                <rect
                                    x={BOARD.x}
                                    y={BOARD.y}
                                    width={BOARD.w}
                                    height={BOARD.h}
                                    rx={boardR}
                                    fill="url(#pcbGrad)"
                                    stroke="#c4b5fd"
                                    strokeWidth={1.2}
                                    filter="url(#boardShadow)"
                                    opacity={0.98}
                                />
                                <rect
                                    x={BOARD.x}
                                    y={BOARD.y}
                                    width={BOARD.w}
                                    height={32}
                                    rx={boardR}
                                    fill="url(#faceHighlight)"
                                    style={{pointerEvents: 'none'}}
                                />

                                {[[BOARD.x + 26, BOARD.y + 26], [BOARD.x + BOARD.w - 26, BOARD.y + 26],
                                    [BOARD.x + 26, BOARD.y + BOARD.h - 26], [BOARD.x + BOARD.w - 26, BOARD.y + BOARD.h - 26]
                                ].map(([hx, hy]) => (
                                    <g key={`${hx}-${hy}`}>
                                        <circle cx={hx} cy={hy} r={5.5} fill="#1e1b4b" stroke="#ddd6fe" strokeWidth={0.8} />
                                        <circle cx={hx} cy={hy} r={2.4} fill="#0f172a" />
                                    </g>
                                ))}

                                {/* Zone labels — digital top/right, analog bottom; title above the chip */}
                                <text
                                    x={cx}
                                    y={BOARD.y + 20}
                                    textAnchor="middle"
                                    fill={K.digital}
                                    fontSize={9}
                                    fontWeight={700}
                                    opacity={0.6}
                                    letterSpacing={1.4}
                                >
                                    DIGITAL
                                </text>
                                <text
                                    x={cx}
                                    y={BOARD.y + 48}
                                    textAnchor="middle"
                                    fill={K.controller}
                                    fontSize={13}
                                    fontWeight={800}
                                    letterSpacing={2.5}
                                    opacity={0.92}
                                >
                                    CONTROLLER
                                </text>
                                <text
                                    x={BOARD.x + BOARD.w - 20}
                                    y={BOARD.y + 88}
                                    textAnchor="middle"
                                    fill={K.orange}
                                    fontSize={8}
                                    fontWeight={700}
                                    opacity={0.55}
                                    letterSpacing={1.2}
                                    transform={`rotate(90 ${BOARD.x + BOARD.w - 20} ${BOARD.y + 88})`}
                                >
                                    MD / I2C
                                </text>
                                <text
                                    x={cx}
                                    y={BOARD.y + BOARD.h - 14}
                                    textAnchor="middle"
                                    fill={K.analog}
                                    fontSize={9}
                                    fontWeight={700}
                                    opacity={0.6}
                                    letterSpacing={1.4}
                                >
                                    ANALOG
                                </text>

                                {/* ESP32-WROOM style module */}
                                {(() => {
                                    const modW = 168;
                                    const modH = 100;
                                    const modX = BOARD.x + ((BOARD.w - modW) / 2);
                                    const modY = BOARD.y + ((BOARD.h - modH) / 2) + 6;
                                    const antW = 36;
                                    const shieldW = modW - antW;
                                    const pad = (px, py, pw, ph) => (
                                        <rect
                                            key={`${px}-${py}`}
                                            x={px}
                                            y={py}
                                            width={pw}
                                            height={ph}
                                            rx={0.8}
                                            fill="url(#espPad)"
                                        />
                                    );
                                    return (
                                        <g>
                                            {/* Antenna keep-out on host PCB (under antenna) */}
                                            <rect
                                                x={modX + shieldW + 2}
                                                y={modY - 2}
                                                width={antW + 4}
                                                height={modH + 4}
                                                rx={3}
                                                fill="#1e1b4b"
                                                opacity={0.55}
                                            />
                                            <rect
                                                x={modX + shieldW + 4}
                                                y={modY}
                                                width={antW}
                                                height={modH}
                                                rx={2}
                                                fill="#0b1020"
                                                stroke="#312e81"
                                                strokeWidth={0.8}
                                                strokeDasharray="3 2"
                                                opacity={0.9}
                                            />

                                            {/* Module PCB body shadow */}
                                            <rect
                                                x={modX + 3}
                                                y={modY + 5}
                                                width={modW}
                                                height={modH}
                                                rx={3}
                                                fill="#020617"
                                                opacity={0.4}
                                            />

                                            {/* Black module PCB */}
                                            <rect
                                                x={modX}
                                                y={modY}
                                                width={modW}
                                                height={modH}
                                                rx={3}
                                                fill="#111827"
                                                stroke="#334155"
                                                strokeWidth={0.8}
                                                filter="url(#chipShadow)"
                                            />

                                            {/* Castellated pads — top */}
                                            {Array.from({length: 12}).map((_, i) => (
                                                pad(modX + 10 + (i * ((shieldW - 20) / 11)), modY - 1.5, 4.5, 3.2)
                                            ))}
                                            {/* bottom */}
                                            {Array.from({length: 12}).map((_, i) => (
                                                pad(modX + 10 + (i * ((shieldW - 20) / 11)), modY + modH - 1.7, 4.5, 3.2)
                                            ))}
                                            {/* left */}
                                            {Array.from({length: 8}).map((_, i) => (
                                                pad(modX - 1.5, modY + 12 + (i * ((modH - 24) / 7)), 3.2, 4.5)
                                            ))}

                                            {/* Metal RF shield */}
                                            <rect
                                                x={modX + 4}
                                                y={modY + 5}
                                                width={shieldW - 6}
                                                height={modH - 10}
                                                rx={2}
                                                fill="url(#espShield)"
                                                stroke="#64748b"
                                                strokeWidth={0.9}
                                            />
                                            {/* Shield seam / vents */}
                                            <rect
                                                x={modX + 8}
                                                y={modY + 9}
                                                width={shieldW - 14}
                                                height={modH - 18}
                                                rx={1.5}
                                                fill="none"
                                                stroke="#475569"
                                                strokeWidth={0.6}
                                                opacity={0.55}
                                            />
                                            <circle cx={modX + 14} cy={modY + 14} r={2.2} fill="#334155" />
                                            <circle cx={modX + 14} cy={modY + 14} r={1.1} fill="#94a3b8" />

                                            <text
                                                x={modX + 8 + ((shieldW - 6) / 2)}
                                                y={modY + (modH / 2) + 2}
                                                textAnchor="middle"
                                                fill="#0f172a"
                                                fontSize={15}
                                                fontWeight={800}
                                                letterSpacing={0.8}
                                            >
                                                ESP-32
                                            </text>
                                            {/* CE mark */}
                                            <g transform={`translate(${modX + shieldW - 28}, ${modY + 16})`} opacity={0.75}>
                                                <circle cx={0} cy={0} r={7} fill="none" stroke="#1e293b" strokeWidth={1.2} />
                                                <text x={0} y={3} textAnchor="middle" fill="#1e293b" fontSize={6} fontWeight={800}>CE</text>
                                            </g>
                                            {/* Espressif-style mark */}
                                            <g transform={`translate(${modX + 22}, ${modY + modH - 22})`} opacity={0.7}>
                                                <circle cx={0} cy={0} r={5.5} fill="none" stroke="#1e293b" strokeWidth={1} />
                                                <circle cx={0} cy={0} r={2.2} fill="#1e293b" />
                                            </g>

                                            {/* Antenna PCB extension */}
                                            <rect
                                                x={modX + shieldW - 2}
                                                y={modY + 4}
                                                width={antW + 2}
                                                height={modH - 8}
                                                rx={2}
                                                fill="url(#espAntenna)"
                                                stroke="#334155"
                                                strokeWidth={0.7}
                                            />
                                            {/* Meander antenna hint */}
                                            <path
                                                d={`M ${modX + shieldW + 8} ${modY + 16}
                                                    h 14 v 8 h -10 v 8 h 10 v 8 h -10 v 8 h 14`}
                                                fill="none"
                                                stroke="#94a3b8"
                                                strokeWidth={1.4}
                                                strokeLinecap="square"
                                                opacity={0.7}
                                            />
                                            <circle cx={modX + shieldW + 2} cy={modY + 22} r={1.4} fill="#fbbf24" />
                                            <circle cx={modX + shieldW + 2} cy={modY + modH - 22} r={1.4} fill="#fbbf24" />
                                        </g>
                                    );
                                })()}
                            </g>
                        );
                    })()}

                    {PORTS.map(port => {
                        const pos = portPosition(port);
                        const conn = usedPorts[port.id];
                        const compatible = Boolean(selectedDef && !conn && isPortCompatible(port, selectedDef));
                        const dimmed = Boolean(selectedDef && !conn && !isPortCompatible(port, selectedDef));
                        return (
                            <Port
                                key={port.id}
                                port={port}
                                x={pos.x}
                                y={pos.y}
                                occupied={Boolean(conn)}
                                compatible={compatible}
                                dimmed={dimmed}
                                flashing={flashPortId === port.id}
                                onClick={() => {
                                    connectToPort(port.id);
                                }}
                            />
                        );
                    })}

                    {connections.map(conn => {
                        const port = PORTS.find(p => p.id === conn.portId);
                        if (!port) {
                            return null;
                        }
                        const pos = portPosition(port);
                        const live = dragModule && dragModule.id === conn.id;
                        const cardX = pos.cardX + (live ? live.x : (conn.offsetX || 0));
                        const cardY = pos.cardY + (live ? live.y : (conn.offsetY || 0));
                        const attach = cardCablePoint(cardX, cardY, port.side);
                        const liveBend = dragBend && dragBend.id === conn.id;
                        const handleX = liveBend
                            ? liveBend.x
                            : (conn.bendX == null ? (pos.cableX + attach.x) / 2 : conn.bendX);
                        const handleY = liveBend
                            ? liveBend.y
                            : (conn.bendY == null ? (pos.cableY + attach.y) / 2 : conn.bendY);
                        return (
                            <g key={conn.id}>
                                <Rj11Cable
                                    x1={pos.cableX}
                                    y1={pos.cableY}
                                    x2={attach.x}
                                    y2={attach.y}
                                    handleX={handleX}
                                    handleY={handleY}
                                    dragging={Boolean(liveBend)}
                                    color={port.signal === 'analog' ? K.analog : K.digital}
                                    connectionId={conn.id}
                                    onBendStart={event => startBendDrag(event, conn, handleX, handleY)}
                                />
                                <ConnectedModuleCard
                                    connection={conn}
                                    x={cardX}
                                    y={cardY}
                                    dragging={Boolean(live)}
                                    onDisconnect={disconnect}
                                    onMoveStart={event => startModuleDrag(event, conn)}
                                />
                            </g>
                        );
                    })}
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default BoardCanvas;
