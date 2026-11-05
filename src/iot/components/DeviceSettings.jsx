import React, {useState} from 'react';

import {writeToken} from '../../beginner-studio/domain/cloudSecrets';
import {errorText, iotApi} from '../../lib/iot-api';
import {prettyKey, timeAgo} from '../format';
import {navigate} from '../router';
import {Banner, Button, Card, Field, inputStyle, useTheme} from '../ui.jsx';

const INTERVALS = [5, 10, 15, 30, 60, 300, 900, 3600];
const FAILSAFE = [0, 10, 30, 60, 300, 900, 3600];

const durationLabel = s => {
    if (s === 0) {
        return 'never';
    }
    if (s < 60) {
        return `${s} s`;
    }
    return s < 3600 ? `${s / 60} min` : `${s / 3600} h`;
};

/**
 * Name, send interval, failsafe values, key and delete for one board.
 * Inside Studio: `simple` folds the failsafe, key and delete cards under "Advanced", `onDeleted(id)`
 * replaces the jump back to the boards list, `onNewKey(id)` hears about a new key, `onChanged(device)`
 * hears about a new name or interval, and `deleteNote` / `intervalHint` adjust the wording.
 */
const DeviceSettings = ({detail, config, actions, simple, onDeleted, onNewKey, onChanged, deleteNote, intervalHint}) => {
    const K = useTheme();
    const device = detail.device;
    const [name, setName] = useState(device.name);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState('');
    const [confirmName, setConfirmName] = useState('');
    const email = config.user ? config.user.email : null;
    const minInterval = config.limits.minIntervalSec;

    const run = async (label, fn) => {
        setBusy(label);
        setError('');
        setDone('');
        try {
            await fn();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy('');
        }
    };

    const patchDevice = (label, body, message) => run(label, async () => {
        const res = await iotApi.updateDevice(device.id, body);
        actions.dispatch({type: 'device/upsert', device: res.device});
        setDone(message);
        if (onChanged) {
            onChanged(res.device);
        }
    });

    const regenerate = () => {
        if (!window.confirm('Make a new key? The board stops connecting until you upload from Beginner Studio again.')) {
            return;
        }
        run('token', async () => {
            const res = await iotApi.regenerateToken(device.id);
            writeToken(email, device.id, res.token);
            await actions.refreshDetail(device.id);
            setDone(onNewKey ?
                'New key saved on this computer. Upload again so the board uses it.' :
                'New key saved on this computer. Upload from Beginner Studio to update the board.');
            if (onNewKey) {
                onNewKey(device.id);
            }
        });
    };

    const enable = () => run('enable', async () => {
        const res = await iotApi.enableDevice(device.id);
        actions.dispatch({type: 'device/upsert', device: res.device});
        setDone('Board turned back on.');
    });

    const setFailsafe = (control, patch) => run(control.key, async () => {
        try {
            const res = await iotApi.setControl(device.id, control.key, Object.assign({expectedVersion: control.version}, patch));
            actions.dispatch({type: 'control/update', id: device.id, control: res.control});
        } catch (err) {
            if (err.code === 'version_conflict' && err.body.control) {
                actions.dispatch({type: 'control/update', id: device.id, control: err.body.control});
            }
            throw err;
        }
    });

    const remove = () => run('delete', async () => {
        await iotApi.deleteDevice(device.id);
        writeToken(email, device.id, null);
        actions.dispatch({type: 'device/removed', id: device.id});
        if (onDeleted) {
            onDeleted(device.id);
        } else {
            navigate('/iot', {replace: true});
        }
    });

    const advanced = cards => (simple ? (
        <details style={{border: `1px solid ${K.border}`, borderRadius: 14, padding: '10px 14px'}}>
            <summary style={{cursor: 'pointer', fontWeight: 700, fontSize: 13, color: K.sub}}>
                Advanced (for teachers): WiFi loss, board key, delete
            </summary>
            <div style={{display: 'grid', gap: 12, marginTop: 12}}>{cards}</div>
        </details>
    ) : cards);

    return (
        <div style={{display: 'grid', gap: 12}}>
            {error ? <Banner tone="error">{error}</Banner> : null}
            {done ? <Banner tone="ok">{done}</Banner> : null}

            {device.status === 'disabled' ? (
                <Banner
                    tone="error"
                    action={<Button kind="primary" disabled={busy === 'enable'} onClick={enable}>Turn back on</Button>}
                >
                    This board is paused{device.disabledReason === 'flooding' ? ' because it sent data too fast. Fix the program (use a Wait block), upload, then turn it back on.' : '.'}
                </Banner>
            ) : null}
            {device.warning ? (
                <Banner
                    tone="warn"
                    action={<Button onClick={() => patchDevice('warn', {clearWarning: true}, 'Warning cleared.')}>Dismiss</Button>}
                >
                    {device.warning === 'restarting' ?
                        'This board keeps reconnecting. Check its power and USB cable, or make sure no other board uses the same key.' :
                        device.warning}
                </Banner>
            ) : null}

            <Card>
                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end'}}>
                    <Field label="Name">
                        <input value={name} maxLength={40} onChange={e => setName(e.target.value)} style={Object.assign(inputStyle(K), {width: 220})} />
                    </Field>
                    <Button
                        disabled={busy === 'name' || !name.trim() || name.trim() === device.name}
                        onClick={() => patchDevice('name', {name: name.trim()}, 'Name saved.')}
                    >
                        Save name
                    </Button>
                    <Field label="Board sends readings" hint={intervalHint || 'Change it in Beginner Studio too, then upload.'}>
                        <select
                            value={device.intervalSec}
                            onChange={e => patchDevice('interval', {intervalSec: Number(e.target.value)}, 'Interval saved.')}
                            style={inputStyle(K)}
                        >
                            {INTERVALS.filter(s => s >= minInterval || s === device.intervalSec).map(s => (
                                <option key={s} value={s}>every {durationLabel(s)}</option>
                            ))}
                        </select>
                    </Field>
                </div>
            </Card>

            {advanced(<React.Fragment>
                {detail.controls.length ? (
                    <Card>
                        <div style={{fontWeight: 800, marginBottom: 6}}>If the board loses WiFi</div>
                        <div style={{fontSize: 12, color: K.dim, marginBottom: 10}}>
                            After this long offline, the board sets the control to a safe value by itself (for example, motor off).
                        </div>
                        <div style={{display: 'grid', gap: 8}}>
                            {detail.controls.map(c => (
                                <div key={c.key} style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
                                    <span style={{width: 90, fontWeight: 700, fontSize: 13}}>{prettyKey(c.key)}</span>
                                    <select
                                        aria-label={`${c.key} failsafe delay`}
                                        value={c.failsafeSec}
                                        disabled={busy === c.key}
                                        onChange={e => setFailsafe(c, {failsafeSec: Number(e.target.value)})}
                                        style={inputStyle(K)}
                                    >
                                        {FAILSAFE.map(s => <option key={s} value={s}>{s === 0 ? 'keep last value' : `after ${durationLabel(s)}`}</option>)}
                                    </select>
                                    {c.failsafeSec > 0 ? (
                                        c.kind === 'switch' ? (
                                            <select
                                                aria-label={`${c.key} failsafe value`}
                                                value={c.failsafeValue}
                                                disabled={busy === c.key}
                                                onChange={e => setFailsafe(c, {failsafeValue: Number(e.target.value)})}
                                                style={inputStyle(K)}
                                            >
                                                <option value={0}>turn off</option>
                                                <option value={1}>turn on</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                aria-label={`${c.key} failsafe value`}
                                                defaultValue={c.failsafeValue}
                                                disabled={busy === c.key}
                                                onBlur={e => {
                                                    const v = Math.round(Number(e.target.value));
                                                    if (Number.isFinite(v) && v !== c.failsafeValue && v >= 0 && v <= 100) {
                                                        setFailsafe(c, {failsafeValue: v});
                                                    }
                                                }}
                                                style={Object.assign(inputStyle(K), {width: 80})}
                                            />
                                        )
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </Card>
                ) : null}

                <Card>
                    <div style={{fontWeight: 800, marginBottom: 6}}>Device key</div>
                    <div style={{fontSize: 12, color: K.dim, marginBottom: 10}}>
                        Key starting <code>{device.tokenPrefix}…</code> · board made {timeAgo(device.createdAt)}.
                        Make a new key if this one leaked (for example, the code was shared with the key in it).
                    </div>
                    <Button disabled={busy === 'token'} onClick={regenerate}>Make a new key</Button>
                </Card>

                <Card style={{borderColor: K.red}}>
                    <div style={{fontWeight: 800, marginBottom: 6, color: K.red}}>Delete board</div>
                    <div style={{fontSize: 12, color: K.dim, marginBottom: 10}}>
                        The board stops connecting at once; its readings, dashboard and alerts are erased within 7 days.
                        {deleteNote ? ` ${deleteNote}` : ''} Type its name to confirm.
                    </div>
                    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                        <input
                            value={confirmName}
                            onChange={e => setConfirmName(e.target.value)}
                            placeholder={device.name}
                            aria-label="Type the board name to confirm"
                            style={Object.assign(inputStyle(K), {width: 220})}
                        />
                        <Button kind="danger" disabled={busy === 'delete' || confirmName.trim() !== device.name} onClick={remove}>
                            Delete forever
                        </Button>
                    </div>
                </Card>
            </React.Fragment>)}
        </div>
    );
};

export default DeviceSettings;
