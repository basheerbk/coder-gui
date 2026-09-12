import React, {useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import useBoardUpload from '../../hooks/useBoardUpload.js';

const colorize = (line, K) => {
    if (/^\s*\/\//.test(line) || line.indexOf('//') === 0) {
        return {color: K.muted};
    }
    if (line.indexOf('#include') !== -1) {
        return {color: K.orange};
    }
    if (/\bvoid\b/.test(line)) {
        return {color: K.accent};
    }
    if (/\b(int|float|long|Servo|DHT|Adafruit_SSD1306)\b/.test(line)) {
        return {color: '#f472b6'};
    }
    if (/\bdelay\b/.test(line)) {
        return {color: K.orange};
    }
    return {color: K.sub};
};

const LiveCodePanel = () => {
    const {generatedCode, showCodePanel, setShowCodePanel, K} = useStudio();
    const [copied, setCopied] = useState(false);
    const upload = useBoardUpload();

    if (!showCodePanel) {
        return (
            <button
                type="button"
                onClick={() => setShowCodePanel(true)}
                style={{
                    position: 'absolute',
                    right: 10,
                    top: 10,
                    zIndex: 2,
                    background: K.panel,
                    color: K.text,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    border: `1px solid ${K.border}`
                }}
            >
                Show code
            </button>
        );
    }

    const lines = (generatedCode || '').split('\n');

    const handleCopy = () => {
        const done = () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(generatedCode).then(done).catch(() => {});
            return;
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = generatedCode;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
        } catch (err) {
            // ignore
        }
    };

    const statusColor = () => {
        if (upload.phase === 'success') {
            return K.green;
        }
        if (upload.phase === 'error') {
            return K.red;
        }
        if (upload.phase === 'uploading' || upload.phase === 'connecting') {
            return K.orange;
        }
        return K.dim;
    };

    return (
        <aside
            style={{
                width: 300,
                flexShrink: 0,
                background: K.codeBg,
                borderLeft: `1px solid ${K.border}`,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    borderBottom: `1px solid ${K.border}`,
                    flexWrap: 'wrap'
                }}
            >
                <div style={{fontSize: 12, fontWeight: 700, flex: 1, minWidth: 70}}>Arduino C++</div>
                <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                        border: 'none',
                        background: K.surface,
                        color: K.text,
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 10,
                        cursor: 'pointer'
                    }}
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                    type="button"
                    onClick={() => setShowCodePanel(false)}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        color: K.dim,
                        cursor: 'pointer',
                        fontSize: 12
                    }}
                >
                    Close
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '8px 10px',
                    borderBottom: `1px solid ${K.border}`,
                    background: K.panel
                }}
            >
                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                    <button
                        type="button"
                        disabled={upload.busy}
                        onClick={upload.connectBoard}
                        style={{
                            border: `1px solid ${K.border}`,
                            background: upload.connected ? `${K.green}22` : K.surface,
                            color: upload.connected ? K.green : K.text,
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: upload.busy ? 'wait' : 'pointer',
                            opacity: upload.busy ? 0.6 : 1
                        }}
                    >
                        {upload.connected ? 'Connected' : 'Connect board'}
                    </button>
                    <button
                        type="button"
                        disabled={upload.busy || !generatedCode}
                        onClick={() => upload.uploadCode(generatedCode)}
                        style={{
                            border: 'none',
                            background: K.accent,
                            color: '#fff',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: upload.busy || !generatedCode ? 'not-allowed' : 'pointer',
                            opacity: upload.busy || !generatedCode ? 0.55 : 1,
                            flex: 1,
                            minWidth: 100
                        }}
                    >
                        {upload.phase === 'uploading' ? 'Uploading…' : 'Upload'}
                    </button>
                    {upload.phase === 'uploading' ? (
                        <button
                            type="button"
                            onClick={upload.cancelUpload}
                            style={{
                                border: `1px solid ${K.border}`,
                                background: K.surface,
                                color: K.red,
                                borderRadius: 8,
                                padding: '6px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    ) : null}
                </div>
                <div style={{fontSize: 10, color: statusColor(), fontWeight: 600, lineHeight: 1.35}}>
                    {!upload.supported
                        ? 'Upload needs Chrome or Edge on a computer.'
                        : (upload.message ||
                            (upload.connected
                                ? `Ready · ${upload.portLabel || 'Maker ESP32'}`
                                : 'Connect your Maker ESP32, then Upload.'))}
                </div>
                {upload.log ? (
                    <pre
                        style={{
                            margin: 0,
                            maxHeight: 72,
                            overflow: 'auto',
                            fontSize: 9,
                            lineHeight: 1.35,
                            color: K.muted,
                            background: K.codeBg,
                            borderRadius: 6,
                            padding: 6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {upload.log.slice(-1200)}
                    </pre>
                ) : null}
            </div>

            <pre
                style={{
                    margin: 0,
                    flex: 1,
                    overflow: 'auto',
                    padding: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 10,
                    lineHeight: 1.45
                }}
            >
                {lines.map((line, i) => (
                    <div key={`L${i}`} style={{display: 'flex', minWidth: '100%'}}>
                        <span
                            style={{
                                width: 32,
                                flexShrink: 0,
                                textAlign: 'right',
                                padding: '0 8px',
                                color: K.muted,
                                userSelect: 'none',
                                background: K.codeGutter
                            }}
                        >
                            {i + 1}
                        </span>
                        <span style={Object.assign({paddingRight: 10, whiteSpace: 'pre'}, colorize(line, K))}>
                            {line || ' '}
                        </span>
                    </div>
                ))}
            </pre>
        </aside>
    );
};

export default LiveCodePanel;
