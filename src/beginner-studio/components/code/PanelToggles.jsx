import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const PanelToggles = () => {
    const {showCodePanel, setShowCodePanel, showSerial, setShowSerial, K} = useStudio();
    const chip = active => ({
        border: `1px solid ${active ? K.accent : K.border}`,
        background: active ? `${K.accent}22` : K.surface,
        color: active ? K.accent : K.sub,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer'
    });
    return (
        <>
            <button
                type="button"
                aria-pressed={showCodePanel}
                onClick={() => setShowCodePanel(!showCodePanel)}
                style={chip(showCodePanel)}
            >
                {showCodePanel ? 'Hide code' : 'Show code'}
            </button>
            <button
                type="button"
                aria-pressed={showSerial}
                onClick={() => setShowSerial(!showSerial)}
                title="See what your board prints"
                style={chip(showSerial)}
            >
                Board messages
            </button>
        </>
    );
};

export default PanelToggles;
