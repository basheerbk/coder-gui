import React, {useEffect, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {friendlyUpload} from '../../domain/friendlyUpload';

const DONE_MS = 4000;

const Popover = ({K, tone, children, onClose}) => (
    <div
        role={tone === 'error' ? 'alert' : 'status'}
        style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 290,
            zIndex: 50,
            background: K.panel,
            border: `1px solid ${tone === 'error' ? K.red : K.orange}`,
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            fontSize: 12,
            lineHeight: 1.45,
            color: K.text
        }}
    >
        <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
                position: 'absolute',
                top: 4,
                right: 6,
                border: 'none',
                background: 'transparent',
                color: K.dim,
                fontSize: 16,
                cursor: 'pointer'
            }}
        >
            ×
        </button>
        <div style={{paddingRight: 16}}>{children}</div>
    </div>
);

const UploadButton = () => {
    const {K, setShowCloudSetup} = useStudio();
    const upload = useUpload();
    const {phase, progress, connected, busy, cloudNote, setCloudNote} = upload;
    const friendly = friendlyUpload(upload);
    const [showDone, setShowDone] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);

    useEffect(() => {
        if (phase === 'success') {
            setShowDone(true);
            const timer = setTimeout(() => setShowDone(false), DONE_MS);
            return () => clearTimeout(timer);
        }
        setShowDone(false);
        setErrorOpen(phase === 'error');
    }, [phase, upload.message]);

    const uploading = phase === 'uploading';
    const failed = phase === 'error';

    let label = connected ? 'Upload' : 'Connect board';
    let color = K.accent;
    if (phase === 'connecting') {
        label = 'Connecting…';
    } else if (uploading) {
        label = `Uploading… ${progress || 0}%`;
    } else if (showDone) {
        label = 'Done!';
        color = K.green;
    } else if (failed) {
        label = 'Try again';
        color = K.red;
    }

    const handleClick = () => {
        setErrorOpen(false);
        if (connected || failed) {
            upload.handleUpload();
        } else {
            upload.connectBoard();
        }
    };

    const pct = uploading ? Math.max(4, progress || 0) : 100;

    return (
        <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 6}}>
            {busy ? (
                <span
                    role="status"
                    title={friendly.text}
                    style={{
                        maxWidth: 220,
                        fontSize: 11,
                        color: K.sub,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {friendly.text}
                </span>
            ) : null}
            <button
                type="button"
                onClick={handleClick}
                disabled={busy}
                title={connected ? 'Send your program to the board' : 'Plug in your board with USB, then click here'}
                style={{
                    minWidth: 128,
                    height: 34,
                    border: 'none',
                    background: uploading ?
                        `linear-gradient(90deg, ${color} ${pct}%, ${color}66 ${pct}%)` :
                        color,
                    color: '#fff',
                    borderRadius: 9,
                    padding: '0 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: busy ? 'default' : 'pointer',
                    opacity: phase === 'connecting' ? 0.7 : 1
                }}
            >
                {label}
            </button>
            {uploading ? (
                <button
                    type="button"
                    onClick={upload.cancelUpload}
                    style={{
                        border: `1px solid ${K.border}`,
                        background: K.surface,
                        color: K.text,
                        borderRadius: 8,
                        padding: '6px 10px',
                        fontSize: 12,
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
            ) : null}

            {cloudNote ? (
                <Popover
                    K={K}
                    tone="warn"
                    onClose={() => setCloudNote('')}
                >
                    <div>{cloudNote}</div>
                    <button
                        type="button"
                        onClick={() => {
                            setCloudNote('');
                            setShowCloudSetup(true);
                        }}
                        style={{
                            marginTop: 8,
                            border: 'none',
                            background: K.accent,
                            color: '#fff',
                            borderRadius: 6,
                            padding: '5px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Open Cloud setup
                    </button>
                </Popover>
            ) : null}

            {!cloudNote && failed && errorOpen ? (
                <Popover
                    K={K}
                    tone="error"
                    onClose={() => setErrorOpen(false)}
                >
                    <div style={{fontWeight: 600}}>{friendly.text}</div>
                    {friendly.tip ? (
                        <div style={{marginTop: 6, color: K.sub}}>{friendly.tip}</div>
                    ) : null}
                </Popover>
            ) : null}
        </div>
    );
};

export default UploadButton;
