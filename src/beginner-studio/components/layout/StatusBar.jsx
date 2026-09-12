import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const StatusBar = () => {
    const {setShowProjectLibrary, K} = useStudio();
    return (
        <footer
            style={{
                height: 26,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                background: K.panel,
                borderTop: `1px solid ${K.border}`,
                fontSize: 11,
                color: K.muted
            }}
        >
            <span>Sound · RJ11 cables</span>
            <div style={{flex: 1}} />
            <button
                type="button"
                onClick={() => setShowProjectLibrary(true)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: K.dim,
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0
                }}
            >
                All projects
            </button>
        </footer>
    );
};

export default StatusBar;
