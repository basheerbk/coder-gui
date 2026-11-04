import React from 'react';

/** "Then this happens next": a short line with an arrowhead between two blocks. */
const FlowConnector = ({tone}) => (
    <div
        aria-hidden
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: 20,
            flexShrink: 0,
            pointerEvents: 'none'
        }}
    >
        <div style={{width: 2, flex: 1, background: tone, borderRadius: 2, opacity: 0.7}} />
        <svg width="10" height="6" viewBox="0 0 10 6" style={{display: 'block', marginTop: -1}}>
            <path
                d="M1 1l4 4 4-4"
                fill="none"
                stroke={tone}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    </div>
);

export default FlowConnector;
