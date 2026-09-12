import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const EmptyState = ({title, hint, actionLabel, onAction}) => {
    const {K} = useStudio();
    return (
        <div
            style={{
                padding: 28,
                textAlign: 'center',
                color: K.dim,
                animation: 'tbSlideIn 0.25s ease'
            }}
        >
            <div style={{fontSize: 15, fontWeight: 600, color: K.sub, marginBottom: 6}}>{title}</div>
            {hint ? <div style={{fontSize: 12, lineHeight: 1.5, marginBottom: 12}}>{hint}</div> : null}
            {actionLabel && onAction ? (
                <button
                    type="button"
                    onClick={onAction}
                    style={{
                        background: K.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
};

export default EmptyState;
