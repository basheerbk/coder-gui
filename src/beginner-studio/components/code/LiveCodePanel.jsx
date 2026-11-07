import React, {useMemo, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {usesAi} from '../../domain/ai/aiFirmware';
import {MICROPYTHON} from '../../domain/boardLanguage';
import {generateArduino} from '../../domain/codegen';
import {comingSoonNote, micropythonGaps} from '../../domain/pycodegen';

import SerialMonitorPanel from './SerialMonitorPanel.jsx';

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
    if (/\b(int|float|long|Servo|DHT|Adafruit_SSD1306|MAX30105)\b/.test(line)) {
        return {color: '#f472b6'};
    }
    if (/\bdelay\b/.test(line)) {
        return {color: K.orange};
    }
    return {color: K.sub};
};

const colorizePython = (line, K) => {
    if (/^\s*#/.test(line)) {
        return {color: K.muted};
    }
    if (/^import\b/.test(line)) {
        return {color: K.orange};
    }
    if (/^\s*(while|for|if|else)\b/.test(line)) {
        return {color: K.accent};
    }
    if (/\btinkerbit\./.test(line)) {
        return {color: '#f472b6'};
    }
    if (/\btime\.sleep/.test(line)) {
        return {color: K.orange};
    }
    return {color: K.sub};
};

const copyText = (text, done) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done)
            .catch(() => {});
        return;
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
    } catch (err) {
        // ignore
    }
};

const CodeSection = ({K}) => {
    const {generatedCode, connections, program, cloud, ai, boardTarget} = useStudio();
    const upload = useUpload();
    const [copied, setCopied] = useState(false);
    const lines = (generatedCode || '').split('\n');
    const showDetails = Boolean(upload.log) || upload.phase === 'error';
    const python = boardTarget === MICROPYTHON;
    const gaps = useMemo(
        () => (python ? micropythonGaps(connections, program) : []),
        [python, connections, program]
    );
    const paint = python ? colorizePython : colorize;

    // The preview leaves out the AI's examples; a copy has to work on its own.
    const handleCopy = () => copyText(!python && usesAi(program) ?
        generateArduino(connections, program, {cloud, ai, aiModel: true}) :
        generatedCode, () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    });

    return (
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderBottom: `1px solid ${K.border}`
                }}
            >
                <div style={{fontSize: 12, fontWeight: 700, flex: 1}}>
                    {python ? 'Your program as MicroPython' : 'Your program as code'}
                </div>
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
            </div>

            {gaps.length ? (
                <div style={{padding: '6px 10px', borderBottom: `1px solid ${K.border}`, fontSize: 11, color: K.sub}}>
                    {comingSoonNote(gaps)}
                </div>
            ) : null}

            {showDetails ? (
                <details style={{padding: '6px 10px', borderBottom: `1px solid ${K.border}`, fontSize: 11}}>
                    <summary style={{cursor: 'pointer', color: K.sub}}>Details</summary>
                    <pre
                        style={{
                            margin: '6px 0 0',
                            maxHeight: 120,
                            overflow: 'auto',
                            fontSize: 9,
                            lineHeight: 1.35,
                            color: K.muted,
                            background: K.panel,
                            borderRadius: 6,
                            padding: 6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {[upload.message, upload.log.slice(-1200)].filter(Boolean)
                            .join('\n')}
                    </pre>
                </details>
            ) : null}

            <pre
                style={{
                    margin: 0,
                    flex: 1,
                    overflow: 'auto',
                    padding: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 10,
                    lineHeight: 1.45,
                    minHeight: 80
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
                        <span style={Object.assign({paddingRight: 10, whiteSpace: 'pre'}, paint(line, K))}>
                            {line || ' '}
                        </span>
                    </div>
                ))}
            </pre>
        </div>
    );
};

// Optional side panel: generated C++ and the board's serial output, both hidden by default.
const LiveCodePanel = () => {
    const {showCodePanel, showSerial, K} = useStudio();
    const upload = useUpload();

    if (!showCodePanel && !showSerial) {
        return null;
    }

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
            {showCodePanel ? <CodeSection K={K} /> : null}
            {showSerial ? (
                <SerialMonitorPanel
                    connected={upload.connected}
                    fill={!showCodePanel}
                />
            ) : null}
        </aside>
    );
};

export default LiveCodePanel;
