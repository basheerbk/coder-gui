import React, {useEffect, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

import BoardCanvas from './BoardCanvas.jsx';
import Board3DView from './board3d/Board3DView.jsx';
import ComponentShelf from './ComponentShelf.jsx';

const MODES = [
    {id: 'edit', label: 'Edit'},
    {id: '3d', label: '3D'}
];

const BuildView = () => {
    const {clearSelection, K} = useStudio();
    const [mode, setMode] = useState('edit');

    useEffect(() => {
        const onKey = event => {
            if (event.key === 'Escape') {
                clearSelection();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [clearSelection]);

    return (
        <div style={{flex: 1, display: 'flex', minHeight: 0, background: K.canvas}}>
            <ComponentShelf />
            <div style={{flex: 1, minWidth: 0, display: 'flex', position: 'relative'}}>
                {mode === '3d' ? <Board3DView /> : <BoardCanvas />}
                <div
                    role="radiogroup"
                    aria-label="Board view"
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 4,
                        display: 'flex',
                        padding: 3,
                        gap: 2,
                        background: K.panel,
                        border: `1px solid ${K.border}`,
                        borderRadius: 10,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                    }}
                >
                    {MODES.map(m => {
                        const active = mode === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setMode(m.id)}
                                style={{
                                    font: 'inherit',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: '6px 14px',
                                    borderRadius: 8,
                                    border: 0,
                                    background: active ? K.accent : 'transparent',
                                    color: active ? '#fff' : K.text,
                                    cursor: 'pointer'
                                }}
                            >
                                {m.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BuildView;
