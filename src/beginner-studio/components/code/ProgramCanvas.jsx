import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import EmptyState from '../shared/EmptyState.jsx';

import FlowConnector from './FlowConnector.jsx';
import PanelToggles from './PanelToggles.jsx';
import ProgramBlock from './ProgramBlock.jsx';

const LoopIcon = ({size = 14}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M4 12a8 8 0 0113.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 01-13.7 5.6L4 15.3M4 20v-4.7h4.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const UpArrow = ({color}) => (
    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden style={{display: 'block'}}>
        <path
            d="M1.5 6.5L6 2l4.5 4.5"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/** The board runs loop() over and over; the frame and its left return line make that visible. */
const ForeverFrame = ({K, children}) => (
    <div
        style={{
            position: 'relative',
            maxWidth: 680,
            margin: '6px auto 0',
            padding: '30px 18px 38px 32px',
            border: `2px dashed ${K.accent}66`,
            borderRadius: 18,
            background: `${K.accent}0d`
        }}
    >
        <div
            style={{
                position: 'absolute',
                top: -13,
                left: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: K.accent,
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                boxShadow: `0 3px 0 ${K.accent}88`,
                zIndex: 1
            }}
        >
            <LoopIcon />
            {'Repeat forever'}
        </div>
        <div aria-hidden style={{position: 'absolute', left: 8, top: 16, pointerEvents: 'none'}}>
            <UpArrow color={K.accent} />
        </div>
        <div
            aria-hidden
            style={{
                position: 'absolute',
                left: 13,
                top: 19,
                bottom: 17,
                width: 18,
                borderLeft: `2px solid ${K.accent}88`,
                borderBottom: `2px solid ${K.accent}88`,
                borderBottomLeftRadius: 10,
                pointerEvents: 'none'
            }}
        />
        {children}
        <div
            style={{
                position: 'absolute',
                bottom: 9,
                left: 36,
                right: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: K.accent,
                whiteSpace: 'nowrap',
                overflow: 'hidden'
            }}
        >
            {'then back to the top'}
        </div>
    </div>
);

const ProgramCanvas = () => {
    const {program, clearProgram, setView, connections, K} = useStudio();

    return (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                background: K.canvas,
                minHeight: 0
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    borderBottom: `1px solid ${K.border}`
                }}
            >
                <div style={{fontSize: 13, fontWeight: 700, flex: 1}}>Program</div>
                <PanelToggles />
                <button
                    type="button"
                    onClick={clearProgram}
                    style={{
                        border: 'none',
                        background: K.surface,
                        color: K.sub,
                        borderRadius: 8,
                        padding: '5px 10px',
                        fontSize: 11,
                        cursor: 'pointer'
                    }}
                >
                    Clear
                </button>
            </div>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 18px 28px',
                    backgroundColor: K.canvas,
                    backgroundImage: `radial-gradient(circle, ${K.gridDot} 1px, transparent 1.4px)`,
                    backgroundSize: '18px 18px'
                }}
            >
                {program.length === 0 ? (
                    <EmptyState
                        title="Your program is empty"
                        hint={connections.length ?
                            'Click a block on the left to add it.' :
                            'Add parts in Build, then come back to add blocks.'}
                        actionLabel={connections.length ? null : 'Go to Build'}
                        onAction={connections.length ? null : () => setView('build')}
                    />
                ) : (
                    <ForeverFrame K={K}>
                        <div style={{position: 'relative', display: 'flex', flexDirection: 'column'}}>
                            {program.map((block, index) => (
                                <React.Fragment key={block.uid}>
                                    {index > 0 ? <FlowConnector tone={K.accent} /> : null}
                                    <ProgramBlock block={block} />
                                </React.Fragment>
                            ))}
                        </div>
                    </ForeverFrame>
                )}
            </div>
        </div>
    );
};

export default ProgramCanvas;
