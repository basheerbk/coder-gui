import React, {useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../../../context/StudioContext.jsx';
import {moduleById} from '../../../../domain/modules';
import {PORTS, portLinks, portUiState, usedPortMap} from '../../../../domain/ports';
import {portTitle} from '../../Port.jsx';
import StageControls from '../StageControls.jsx';

import SceneController from './SceneController';

const SR_ONLY = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0
};

/** WebGL board. Studio state goes into a SceneController; overlays stay as regular DOM. */
const Board3DGL = ({onFatal}) => {
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

    const hostRef = useRef(null);
    const tooltipRef = useRef(null);
    const ctlRef = useRef(null);
    const badgeEls = useRef(new Map());
    const latest = useRef(null);
    latest.current = {connectToPort, clearSelection, onFatal};

    const [viewKey, setViewKey] = useState('v3d');
    const [zoomPct, setZoomPct] = useState(100);
    const [dragging, setDragging] = useState(false);
    const [context, setContext] = useState('ok');

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;
    const usedPorts = useMemo(() => usedPortMap(connections), [connections]);
    const liveLinks = useMemo(() => portLinks(connections, K), [connections, K]);

    useEffect(() => {
        let ctl;
        try {
            ctl = new SceneController(hostRef.current, {
                onPort: portId => latest.current.connectToPort(portId),
                onEmpty: () => latest.current.clearSelection(),
                onView: view => {
                    setViewKey(view.viewKey);
                    setZoomPct(view.zoomPct);
                },
                onDragging: setDragging,
                onContext: setContext,
                onFatal: err => latest.current.onFatal(err)
            });
        } catch (err) {
            latest.current.onFatal(err);
            return undefined;
        }
        ctlRef.current = ctl;
        ctl.setTooltipEl(tooltipRef.current);
        badgeEls.current.forEach((el, id) => ctl.setBadgeEl(id, el));
        return () => {
            ctlRef.current = null;
            ctl.dispose();
        };
    }, []);

    useEffect(() => {
        if (ctlRef.current) {
            ctlRef.current.sync({connections, usedPorts, liveLinks, selectedDef, flashPortId, K});
        }
    }, [connections, usedPorts, liveLinks, selectedDef, flashPortId, K]);

    const badgeRef = id => el => {
        if (el) {
            badgeEls.current.set(id, el);
        } else {
            badgeEls.current.delete(id);
        }
        if (ctlRef.current) {
            ctlRef.current.setBadgeEl(id, el);
        }
    };

    const withCtl = fn => (...args) => {
        if (ctlRef.current) {
            fn(ctlRef.current, ...args);
        }
    };

    return (
        <div
            ref={hostRef}
            className={dragging ? 'tb3d-stage tb3d-drag' : 'tb3d-stage'}
            style={{background: `radial-gradient(120% 90% at 50% 38%, ${K.canvasGlow} 0%, ${K.canvas} 72%)`}}
        >
            <div style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1}}>
                {connections.map(conn => {
                    const name = (moduleById(conn.moduleId) || {}).name || conn.moduleId;
                    return (
                        <button
                            key={conn.id}
                            ref={badgeRef(conn.id)}
                            type="button"
                            data-tb3d-ui
                            aria-label={`Unplug ${name}`}
                            title={`Unplug ${name}`}
                            onClick={() => disconnect(conn.id)}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: 22,
                                height: 22,
                                padding: 0,
                                borderRadius: '50%',
                                border: '2px solid #fff',
                                background: K.red,
                                color: '#fff',
                                font: '800 12px/1 system-ui, sans-serif',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                                pointerEvents: dragging ? 'none' : 'auto',
                                visibility: 'hidden'
                            }}
                        >
                            {'×'}
                        </button>
                    );
                })}
            </div>

            <div
                ref={tooltipRef}
                role="presentation"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    zIndex: 5,
                    maxWidth: 240,
                    padding: '5px 9px',
                    borderRadius: 6,
                    background: K.panel,
                    color: K.text,
                    border: `1px solid ${K.border}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    visibility: 'hidden'
                }}
            />

            <div
                data-tb3d-ui
                role="group"
                aria-label="Board jacks"
                style={SR_ONLY}
            >
                {PORTS.map(port => {
                    const state = portUiState(port, usedPorts, selectedDef);
                    return (
                        <button
                            key={port.id}
                            type="button"
                            aria-disabled={state.dimmed || state.occupied}
                            onFocus={withCtl(ctl => ctl.setFocusPort(port.id))}
                            onBlur={withCtl(ctl => ctl.setFocusPort(null))}
                            onClick={() => connectToPort(port.id)}
                        >
                            {`${port.label} jack: ${portTitle(port, state)}`}
                        </button>
                    );
                })}
            </div>

            {context === 'lost' ? (
                <div
                    role="status"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 4,
                        padding: '8px 14px',
                        borderRadius: 10,
                        background: K.panel,
                        color: K.text,
                        border: `1px solid ${K.border}`,
                        fontSize: 12,
                        fontWeight: 600
                    }}
                >
                    {'Restoring the 3D view…'}
                </div>
            ) : null}

            <StageControls
                K={K}
                viewKey={viewKey}
                onView={withCtl((ctl, key) => ctl.chooseView(key))}
                zoomPct={zoomPct}
                onZoom={withCtl((ctl, factor) => ctl.zoomBy(factor))}
                onFit={withCtl(ctl => ctl.resetZoom())}
                wireHint={wireHint}
            />
        </div>
    );
};

export default Board3DGL;
