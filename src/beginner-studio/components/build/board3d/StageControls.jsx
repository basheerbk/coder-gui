import React from 'react';

import {VIEWS, VIEW_KEYS} from './view';

const chipButton = (K, active) => ({
    font: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 11px',
    borderRadius: 8,
    border: `1px solid ${active ? K.accent : K.border}`,
    background: active ? K.accent : K.panel,
    color: active ? '#fff' : K.text,
    cursor: 'pointer'
});

const zoomButton = K => ({
    font: 'inherit',
    fontSize: 16,
    lineHeight: 1,
    color: K.text,
    background: 'transparent',
    border: 0,
    borderRadius: 6,
    minWidth: 32,
    height: 30,
    cursor: 'pointer'
});

const HINT = 'Drag to turn · scroll to zoom · Shift-drag to pan · click a jack to plug in';

/** View presets, zoom buttons, the wiring hint and the help line over a 3D stage. */
const StageControls = ({K, viewKey, onView, zoomPct, onZoom, onFit, wireHint, hint = HINT}) => (
    <React.Fragment>
        {wireHint ? (
            <div
                role="status"
                style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2,
                    maxWidth: '60%',
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

        <div
            data-tb3d-ui
            role="toolbar"
            aria-label="3D view"
            style={{position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', gap: 6}}
        >
            {VIEW_KEYS.map(key => (
                <button
                    key={key}
                    type="button"
                    aria-pressed={viewKey === key}
                    style={chipButton(K, viewKey === key)}
                    onClick={() => onView(key)}
                >
                    {VIEWS[key].label}
                </button>
            ))}
        </div>

        <div
            style={{
                position: 'absolute',
                left: 14,
                bottom: 14,
                zIndex: 3,
                maxWidth: 'calc(100% - 250px)',
                fontSize: 11,
                lineHeight: 1.5,
                color: K.dim,
                pointerEvents: 'none'
            }}
        >
            {hint}
        </div>

        <div
            data-tb3d-ui
            style={{
                position: 'absolute',
                right: 14,
                bottom: 14,
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: 4,
                background: K.panel,
                border: `1px solid ${K.border}`,
                borderRadius: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
            }}
        >
            <button
                type="button"
                aria-label="Zoom out"
                style={zoomButton(K)}
                onClick={() => onZoom(1 / 1.25)}
            >
                {'−'}
            </button>
            <span
                aria-live="polite"
                style={{fontSize: 11.5, minWidth: 44, textAlign: 'center', color: K.dim}}
            >
                {`${zoomPct}%`}
            </span>
            <button
                type="button"
                aria-label="Zoom in"
                style={zoomButton(K)}
                onClick={() => onZoom(1.25)}
            >
                {'+'}
            </button>
            <button
                type="button"
                aria-label="Reset zoom"
                style={{
                    ...zoomButton(K),
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '0 10px',
                    borderLeft: `1px solid ${K.border}`,
                    borderRadius: 0
                }}
                onClick={onFit}
            >
                {'Fit'}
            </button>
        </div>
    </React.Fragment>
);

export default StageControls;
