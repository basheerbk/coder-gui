import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {friendlyUpload} from '../../domain/friendlyUpload';

import {Button, Footer, Note, Spacer, ui} from './wizardUi.jsx';

/**
 * Plug in and upload without leaving the wizard. Uses the same upload as the top-bar button,
 * so closing the wizard mid-upload does not stop it.
 * @param {object} props.w wizard state and actions from CloudWizard
 */
const UploadStep = ({w}) => {
    const {K} = useStudio();
    const upload = useUpload();
    const s = ui(K);
    const friendly = friendlyUpload(upload);
    const {phase, connected, busy, progress} = upload;
    const uploading = phase === 'uploading';
    const pct = uploading ? Math.max(4, progress || 0) : 0;

    let body;
    if (!upload.supported) {
        body = <Note K={K} tone="red" title="Uploading needs Chrome or Edge on a computer" />;
    } else if (uploading) {
        body = (
            <div role="status" aria-live="polite">
                <div style={{fontSize: 14, color: K.text, fontWeight: 600, marginBottom: 8}}>{friendly.text}</div>
                <div style={{height: 10, borderRadius: 5, background: K.surface, overflow: 'hidden'}}>
                    <div style={{width: `${pct}%`, height: '100%', background: K.accent, transition: 'width 0.3s'}} />
                </div>
                <div style={Object.assign({}, s.small, {marginTop: 6})}>
                    Keep the USB cable in. Getting the program ready can take up to a minute.
                </div>
            </div>
        );
    } else {
        body = (
            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                <div
                    aria-hidden="true"
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: connected ? `${K.green}22` : K.surface,
                        color: connected ? K.green : K.sub,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 800
                    }}
                >
                    {connected ? '✓' : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 2v4M15 2v4M7 6h10v5a5 5 0 0 1-10 0V6zM12 16v6" />
                        </svg>
                    )}
                </div>
                <div style={{fontSize: 13, color: K.sub, lineHeight: 1.5}}>
                    {connected ?
                        'Your board is plugged in. Press Upload to send the program with your WiFi and Cloud key.' :
                        'Plug your board into this computer with the USB cable, then press Connect board and pick it in the list.'}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 style={s.title}>Upload to your board</h3>
            <p style={s.lead}>The program, your WiFi and the board's Cloud key go onto “{w.boardName}”.</p>
            {body}
            {phase === 'error' && !uploading ? (
                <Note K={K} tone="red" title={friendly.text}>{friendly.tip || null}</Note>
            ) : null}
            {upload.cloudNote ? <Note K={K} tone="red" title={upload.cloudNote} /> : null}
            <Footer>
                <Button K={K} disabled={busy} onClick={w.back}>Back</Button>
                <Spacer />
                {uploading ? (
                    <Button K={K} onClick={upload.cancelUpload}>Cancel</Button>
                ) : null}
                {!uploading && upload.supported ? (
                    connected ? (
                        <Button K={K} kind="primary" disabled={busy} onClick={upload.handleUpload}>
                            {phase === 'error' ? 'Try again' : 'Upload'}
                        </Button>
                    ) : (
                        <Button K={K} kind="primary" disabled={busy} onClick={upload.connectBoard}>
                            {phase === 'connecting' ? 'Pick your board…' : 'Connect board'}
                        </Button>
                    )
                ) : null}
            </Footer>
            {!uploading ? (
                <div style={{marginTop: 10, textAlign: 'right'}}>
                    <button type="button" style={s.link} onClick={w.close}>I will upload later</button>
                </div>
            ) : null}
        </div>
    );
};

export default UploadStep;
