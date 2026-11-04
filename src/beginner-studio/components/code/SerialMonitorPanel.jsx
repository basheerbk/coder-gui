import React, {useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import useSerialMonitor from '../../hooks/useSerialMonitor.js';

const SerialMonitorPanel = ({connected, fill}) => {
    const {K} = useStudio();
    const serial = useSerialMonitor({connected});
    const [draft, setDraft] = useState('');

    const btn = (active, danger) => ({
        border: `1px solid ${K.border}`,
        background: active ? `${K.green}22` : K.surface,
        color: danger ? K.red : (active ? K.green : K.text),
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer'
    });

    return (
        <div
            style={{
                flex: fill ? 1 : '0 0 220px',
                display: 'flex',
                flexDirection: 'column',
                borderTop: `1px solid ${K.border}`,
                background: K.panel,
                minHeight: 0
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderBottom: `1px solid ${K.border}`,
                    flexWrap: 'wrap'
                }}
            >
                <div
                    title={`Serial monitor at ${serial.baudRate} baud`}
                    style={{fontSize: 11, fontWeight: 800, flex: 1, minWidth: 90}}
                >
                    Board messages
                </div>
                {serial.monitoring ? (
                    <button type="button" onClick={serial.stop} style={btn(false, true)}>
                        Stop
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={!connected}
                        onClick={serial.start}
                        style={Object.assign({}, btn(false), {
                            opacity: connected ? 1 : 0.5,
                            cursor: connected ? 'pointer' : 'not-allowed'
                        })}
                    >
                        Start
                    </button>
                )}
                <button type="button" onClick={serial.clear} style={btn(false)}>
                    Clear
                </button>
            </div>
            <pre
                ref={serial.bottomRef}
                style={{
                    margin: 0,
                    flex: 1,
                    overflow: 'auto',
                    padding: '6px 10px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: K.sub,
                    background: K.codeBg,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {serial.lines ||
                    (serial.monitoring
                        ? 'Listening…'
                        : connected
                            ? 'Press Start to see what your board prints.'
                            : 'Connect your board first (top right), then press Start.')}
            </pre>
            <div
                style={{
                    display: 'flex',
                    gap: 6,
                    padding: '6px 10px',
                    borderTop: `1px solid ${K.border}`
                }}
            >
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            serial.sendLine(draft);
                            setDraft('');
                        }
                    }}
                    placeholder="Type a message for the board…"
                    disabled={!serial.monitoring}
                    style={{
                        flex: 1,
                        border: `1px solid ${K.border}`,
                        borderRadius: 8,
                        padding: '5px 8px',
                        fontSize: 11,
                        background: K.surface,
                        color: K.text,
                        outline: 'none'
                    }}
                />
                <button
                    type="button"
                    disabled={!serial.monitoring || !draft}
                    onClick={() => {
                        serial.sendLine(draft);
                        setDraft('');
                    }}
                    style={Object.assign({}, btn(false), {
                        opacity: serial.monitoring && draft ? 1 : 0.5
                    })}
                >
                    Send
                </button>
            </div>
            {serial.error ? (
                <div style={{padding: '0 10px 6px', fontSize: 10, color: K.red, fontWeight: 600}}>
                    {serial.error}
                </div>
            ) : null}
        </div>
    );
};

export default SerialMonitorPanel;
