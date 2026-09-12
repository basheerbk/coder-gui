import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import EmptyState from '../shared/EmptyState.jsx';

import ProgramBlock from './ProgramBlock.jsx';

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
                    padding: '10px 14px',
                    borderBottom: `1px solid ${K.border}`
                }}
            >
                <div style={{fontSize: 13, fontWeight: 700, flex: 1}}>Program</div>
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
                            'Click a node on the left to add it to the flow.' :
                            'Wire modules in Build, then come back to add nodes.'}
                        actionLabel={connections.length ? null : 'Go to Build'}
                        onAction={connections.length ? null : () => setView('build')}
                    />
                ) : (
                    <div style={{position: 'relative', maxWidth: 420, margin: '0 auto'}}>
                        <div
                            aria-hidden
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 8,
                                bottom: 8,
                                width: 2,
                                marginLeft: -1,
                                background: `linear-gradient(180deg, ${K.accent}33, ${K.dim}22)`,
                                borderRadius: 2,
                                pointerEvents: 'none',
                                zIndex: 0
                            }}
                        />
                        <div style={{position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 0}}>
                            {program.map((block, index) => (
                                <React.Fragment key={block.uid}>
                                    {index > 0 ? (
                                        <div
                                            style={{
                                                width: 2,
                                                height: 16,
                                                margin: '0 auto',
                                                background: `linear-gradient(180deg, ${K.accent}99, ${K.accent}44)`,
                                                borderRadius: 2
                                            }}
                                        />
                                    ) : null}
                                    <ProgramBlock block={block} />
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgramCanvas;
