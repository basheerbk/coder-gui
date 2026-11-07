import React, {useEffect, useRef} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {friendlyUpload} from '../../domain/friendlyUpload';
import {FIRMWARE_API, firmwareOutOfDate, hasTinkerBitFirmware} from '../../micropython/boardInfo';

const boardText = info => {
    if (!info) {
        return '';
    }
    if (hasTinkerBitFirmware(info)) {
        if (firmwareOutOfDate(info)) {
            return Number(info.api) > FIRMWARE_API ?
                'This board has a newer TinkerBit firmware than this page. Reload the page.' :
                'This board has an older TinkerBit firmware. Update it to run your projects.';
        }
        return 'The TinkerBit firmware is on this board and up to date.';
    }
    if (info.lang === 'micropython') {
        return `MicroPython ${info.mpy} is on this board, without the TinkerBit firmware. ` +
            'Update it to use Cloud.';
    }
    if (info.lang === 'arduino') {
        return 'This board runs an Arduino program. Update it to use MicroPython projects.';
    }
    return 'The board did not answer. Update it to set it up for MicroPython.';
};

/**
 * Settings > Update board: shows what the board runs and installs the bundled TinkerBit firmware
 * (MicroPython with the library built in). This is the only place the firmware is installed.
 * @param {{onClose: Function}} props closes the dialog
 * @returns {React.ReactElement} the dialog
 */
const UpdateBoardDialog = ({onClose}) => {
    const {K} = useStudio();
    const upload = useUpload();
    const {connected, supported, boardInfo, update, checkBoard, updateBoard, clearUpdate, connectBoard} = upload;
    const checked = useRef(false);
    const closeRef = useRef(null);
    const installing = update.phase === 'installing';
    const checking = update.phase === 'checking';

    useEffect(() => {
        clearUpdate();
        if (closeRef.current) {
            closeRef.current.focus();
        }
    }, [clearUpdate]);

    useEffect(() => {
        if (connected && !checked.current) {
            checked.current = true;
            checkBoard();
        }
    }, [connected, checkBoard]);

    useEffect(() => {
        const onKey = e => {
            if (e.key === 'Escape' && !installing) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [installing, onClose]);

    let status = boardText(boardInfo);
    let tip = '';
    let tone = K.sub;
    if (!supported) {
        status = 'Open this page in Chrome or Edge on a computer to update the board.';
    } else if (!connected) {
        status = 'Plug in your board with the USB cable, then press Connect board.';
    } else if (checking) {
        status = 'Checking your board…';
    } else if (installing) {
        status = friendlyUpload({phase: 'uploading', message: update.message, supported: true}).text;
    } else if (update.phase === 'done') {
        status = 'Your board is ready. Press Upload to send your program.';
        tone = K.green;
    } else if (update.phase === 'error') {
        const friendly = friendlyUpload({phase: 'error', message: update.message, connected, supported});
        status = friendly.text;
        tip = friendly.tip;
        tone = K.red;
    }

    const pct = installing ? Math.max(4, update.progress || 0) : 0;
    const button = {
        borderRadius: 9,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer'
    };

    return (
        <div
            role="presentation"
            onPointerDown={e => {
                if (e.target === e.currentTarget && !installing) {
                    onClose();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tb-update-board-title"
                style={{
                    width: 400,
                    maxWidth: '100%',
                    background: K.panel,
                    color: K.text,
                    border: `1px solid ${K.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.35)'
                }}
            >
                <h2
                    id="tb-update-board-title"
                    style={{margin: '0 0 6px', fontSize: 17}}
                >
                    {'Update board'}
                </h2>
                <p style={{margin: '0 0 14px', fontSize: 13, color: K.sub, lineHeight: 1.5}}>
                    {'Puts the TinkerBit firmware (MicroPython 1.24.1 with the TinkerBit library and Cloud) ' +
                        'on your board. Takes about a minute. The program on the board and its Cloud ' +
                        'settings are erased.'}
                </p>
                <div
                    role="status"
                    style={{padding: 10, borderRadius: 10, background: K.surface, fontSize: 13, lineHeight: 1.45}}
                >
                    <div style={{color: tone === K.sub ? K.text : tone, fontWeight: 600}}>{status}</div>
                    {tip ? <div style={{marginTop: 6, color: K.sub}}>{tip}</div> : null}
                    {installing ? (
                        <div style={{marginTop: 8, height: 6, borderRadius: 3, background: K.border}}>
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    borderRadius: 3,
                                    background: K.accent,
                                    transition: 'width 0.3s'
                                }}
                            />
                        </div>
                    ) : null}
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18}}>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        disabled={installing}
                        style={Object.assign({}, button, {
                            border: `1px solid ${K.border}`,
                            background: 'transparent',
                            color: K.text,
                            opacity: installing ? 0.5 : 1
                        })}
                    >
                        {update.phase === 'done' ? 'Done' : 'Close'}
                    </button>
                    {supported && !connected ? (
                        <button
                            type="button"
                            onClick={connectBoard}
                            style={Object.assign({}, button, {border: 'none', background: K.accent, color: '#fff'})}
                        >
                            {'Connect board'}
                        </button>
                    ) : null}
                    {supported && connected && update.phase !== 'done' ? (
                        <button
                            type="button"
                            onClick={updateBoard}
                            disabled={installing || checking}
                            style={Object.assign({}, button, {
                                border: 'none',
                                background: K.accent,
                                color: '#fff',
                                fontWeight: 700,
                                cursor: installing || checking ? 'wait' : 'pointer',
                                opacity: installing || checking ? 0.7 : 1
                            })}
                        >
                            {installing ? `Updating… ${update.progress || 0}%` : 'Update board'}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default UpdateBoardDialog;
