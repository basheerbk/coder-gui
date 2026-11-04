import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const ArrowIcon = ({flip}) => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={flip ? {transform: 'scaleX(-1)'} : null}
    >
        <path
            d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const UndoButtons = () => {
    const {undo, redo, canUndo, canRedo, K} = useStudio();
    const style = enabled => ({
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 8,
        padding: 0,
        background: 'transparent',
        color: enabled ? K.text : K.dim,
        opacity: enabled ? 1 : 0.45,
        cursor: enabled ? 'pointer' : 'default'
    });
    return (
        <div style={{display: 'flex', gap: 2}}>
            <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!canUndo}
                onClick={undo}
                style={style(canUndo)}
            >
                <ArrowIcon />
            </button>
            <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Y)"
                disabled={!canRedo}
                onClick={redo}
                style={style(canRedo)}
            >
                <ArrowIcon flip />
            </button>
        </div>
    );
};

export default UndoButtons;
