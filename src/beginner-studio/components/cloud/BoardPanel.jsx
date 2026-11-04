import React, {useEffect, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {panelControls, panelReadings} from '../../domain/cloudPanel';
import {formatValue, timeAgo} from '../../../iot/format';
import {errorText, iotApi} from '../../../lib/iot-api';

import {PhoneLink} from './LiveStep.jsx';
import {Button, Note, ui} from './wizardUi.jsx';

const STATUS_WORDS = {online: 'Online', offline: 'Offline', never: 'Not connected yet', disabled: 'Turned off'};

const Card = ({K, title, children, wide}) => (
    <section
        aria-label={title}
        style={{
            background: K.panel,
            border: `1px solid ${K.border}`,
            borderRadius: 14,
            padding: 16,
            minWidth: 0,
            gridColumn: wide ? '1 / -1' : undefined
        }}
    >
        {title ? <h3 style={{fontSize: 13, fontWeight: 800, color: K.sub, margin: '0 0 10px'}}>{title}</h3> : null}
        {children}
    </section>
);

/** Ticks every few seconds so "updated 5 s ago" keeps moving between polls. */
const useNow = ms => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [ms]);
    return now;
};

const statusLine = (device, now) => {
    if (!device) {
        return 'Checking…';
    }
    if (device.status === 'online') {
        return `Came online ${timeAgo(device.onlineSince, now)}`;
    }
    if (device.status === 'never') {
        return 'Upload to the board, then it joins your WiFi by itself.';
    }
    if (device.status === 'disabled') {
        return device.disabledReason || 'It was sending messages too fast.';
    }
    return device.lastSeen ? `Last seen ${timeAgo(device.lastSeen, now)}` : 'Not seen yet';
};

const controlNote = (control, online, sendError) => {
    if (sendError) {
        return {color: 'red', text: sendError};
    }
    if (!control) {
        return {color: 'dim', text: ''};
    }
    if ((control.ackedVersion || 0) >= control.version) {
        return {color: 'green', text: 'board has it'};
    }
    return online ? {color: 'orange', text: 'sending…'} : {color: 'orange', text: 'the board gets it when it is back online'};
};

const ControlRow = ({K, item, deviceId, online, onControl}) => {
    const {control} = item;
    const [busy, setBusy] = useState(false);
    const [sendError, setSendError] = useState('');
    const [draft, setDraft] = useState(null);
    const send = async value => {
        if (!control) {
            return;
        }
        setBusy(true);
        setSendError('');
        try {
            const res = await iotApi.setControl(deviceId, control.key, {value, expectedVersion: control.version});
            onControl(res.control);
        } catch (err) {
            if (err.code === 'version_conflict' && err.body.control) {
                onControl(err.body.control);
                setSendError('Changed on another screen. Showing the latest.');
            } else {
                setSendError(errorText(err));
            }
        } finally {
            setBusy(false);
        }
    };
    const note = controlNote(control, online, sendError);
    const value = control ? control.value : 0;
    const disabled = !control || busy;

    let input;
    if (item.kind === 'switch') {
        const on = Boolean(value);
        input = (
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={item.label}
                disabled={disabled}
                onClick={() => send(on ? 0 : 1)}
                style={{
                    width: 56,
                    height: 30,
                    borderRadius: 15,
                    border: 'none',
                    padding: 3,
                    flexShrink: 0,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: on ? K.green : K.surface,
                    opacity: disabled ? 0.6 : 1,
                    display: 'flex',
                    justifyContent: on ? 'flex-end' : 'flex-start'
                }}
            >
                <span style={{width: 24, height: 24, borderRadius: 12, background: '#fff', display: 'block'}} />
            </button>
        );
    } else {
        const shown = draft === null ? value : draft;
        const commit = () => {
            if (draft !== null && draft !== value && !busy) {
                send(draft).then(() => setDraft(null));
            } else {
                setDraft(null);
            }
        };
        input = (
            <div style={{display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 160px', maxWidth: 240}}>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={shown}
                    disabled={disabled}
                    aria-label={item.label}
                    onChange={e => setDraft(Number(e.target.value))}
                    onMouseUp={commit}
                    onTouchEnd={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                    style={{flex: 1, accentColor: K.accent}}
                />
                <span style={{width: 30, textAlign: 'right', fontWeight: 800, color: K.text}}>{shown}</span>
            </div>
        );
    }

    return (
        <li style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '6px 0'}}>
            <div style={{flex: '1 1 140px', minWidth: 0}}>
                <div style={{fontSize: 14, fontWeight: 700, color: K.text}}>{item.label}</div>
                <div style={{fontSize: 11, color: K[note.color] || K.dim, minHeight: 14}}>{note.text}</div>
            </div>
            {input}
        </li>
    );
};

/**
 * Home of a set-up Cloud board in the Studio: is it online, what it reads, its switches,
 * and the QR code for the phone.
 * @param {object} props.w setup state and actions from useCloudSetup
 */
const BoardPanel = ({w}) => {
    const {K, connections, program} = useStudio();
    const {cloudLive} = useUpload();
    const s = ui(K);
    const now = useNow(5000);
    const detail = cloudLive.detail && cloudLive.detail.device.id === w.cloud.deviceId ? cloudLive.detail : null;
    const device = detail ? detail.device : null;
    const name = (device && device.name) || w.cloud.deviceName;
    const status = device ? device.status : null;
    const online = status === 'online';
    const readings = panelReadings(connections, program, detail && detail.latest);
    const controls = panelControls(program, detail && detail.controls);
    const dot = {online: K.green, disabled: K.red}[status] || K.dim;

    return (
        <div style={{display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'}}>
            <Card K={K} wide>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                    <span
                        aria-hidden="true"
                        style={{width: 12, height: 12, borderRadius: 6, background: dot, flexShrink: 0}}
                    />
                    <div style={{flex: '1 1 200px', minWidth: 0}}>
                        <h2 style={{fontSize: 18, fontWeight: 800, color: K.text, margin: 0}}>
                            {name}
                            <span style={{fontSize: 13, fontWeight: 600, color: K.sub, marginLeft: 8}}>
                                {STATUS_WORDS[status] || ''}
                            </span>
                        </h2>
                        <div style={s.small}>{statusLine(device, now)}</div>
                    </div>
                    {status === 'disabled' ? (
                        <Button K={K} kind="primary" disabled={Boolean(w.busy)} onClick={w.enable}>Turn it back on</Button>
                    ) : (
                        <Button K={K} kind={status === 'never' ? 'primary' : 'secondary'} onClick={w.goUpload}>
                            {status === 'never' ? 'Upload to the board' : 'Upload again'}
                        </Button>
                    )}
                </div>
                {cloudLive.stage === 'live' ? (
                    <Note K={K} tone="green" title={`“${name}” is live!`}>
                        Scan the code below with your phone to open its dashboard.
                    </Note>
                ) : null}
                {status === 'disabled' ? (
                    <Note K={K} tone="red" title="This board was turned off">
                        If your program repeats quickly, add a Wait block, upload, then turn the board back on.
                    </Note>
                ) : null}
                <div style={{display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap'}}>
                    <button type="button" style={s.link} onClick={w.goBoard}>Change board or WiFi</button>
                </div>
            </Card>

            <Card K={K} title="Readings">
                {readings.length ? (
                    <div style={{display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))'}}>
                        {readings.map(r => (
                            <div key={r.key} style={{background: K.surface, borderRadius: 10, padding: '10px 12px'}}>
                                <div style={{fontSize: 11, color: K.sub, overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.label}</div>
                                <div style={{fontSize: 22, fontWeight: 800, color: online ? K.text : K.dim}}>
                                    {formatValue(r.value, r.unit)}
                                </div>
                                <div style={{fontSize: 11, color: K.dim}}>
                                    {r.ts ? `updated ${timeAgo(r.ts, now)}` : 'no reading yet'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={s.small}>
                        This program does not read any sensors yet. Read a sensor in Code and it shows up here.
                    </div>
                )}
            </Card>

            <Card K={K} title="Switches and sliders">
                {controls.length ? (
                    <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                        {controls.map(item => (
                            <ControlRow
                                key={item.key}
                                K={K}
                                item={item}
                                deviceId={w.cloud.deviceId}
                                online={online}
                                onControl={cloudLive.applyControl}
                            />
                        ))}
                    </ul>
                ) : (
                    <div style={s.small}>
                        Use a Dashboard switch or slider in an If block to control the board from here and from your phone.
                    </div>
                )}
            </Card>

            <Card K={K} title="On your phone" wide>
                <PhoneLink K={K} id={w.cloud.deviceId} name={name} />
            </Card>
        </div>
    );
};

export default BoardPanel;
