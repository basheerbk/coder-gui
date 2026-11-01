import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {CLOUD_DEFAULTS, DEVICE_TOKEN_RE, clampInterval, hasCloud, validateWifi} from '../../domain/cloud';
import {telemetryReadings, usedCloudControls} from '../../domain/cloudFirmware';
import {
    forgetAll,
    readLastDevice,
    readToken,
    readWifi,
    writeLastDevice,
    writeToken,
    writeWifi
} from '../../domain/cloudSecrets';
import {errorText, iotApi} from '../../../lib/iot-api';
import Modal from '../shared/Modal.jsx';

const INTERVALS = [5, 10, 15, 30, 60, 300];

const isLocalHost = () => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
};

const intervalLabel = sec => (sec < 60 ? `every ${sec} s` : `every ${sec / 60} min`);

const statusColor = (K, status) => {
    if (status === 'online') {
        return K.green;
    }
    if (status === 'disabled') {
        return K.red;
    }
    return K.dim;
};

const CloudSetupModal = () => {
    const {
        showCloudSetup,
        setShowCloudSetup,
        cloud,
        setCloud,
        connections,
        program,
        projectName,
        K
    } = useStudio();

    // phase: loading | signed_out | offline | unreachable | disabled | not_in_pilot | ready
    const [phase, setPhase] = useState('loading');
    const loadSeq = useRef(0);
    const [phaseNote, setPhaseNote] = useState('');
    const [config, setConfig] = useState(null);
    const [devices, setDevices] = useState([]);
    const [deviceId, setDeviceId] = useState('');
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [tokenVersion, setTokenVersion] = useState(0);
    const [wifi, setWifi] = useState({ssid: '', password: '', remember: false});
    const [showPass, setShowPass] = useState(false);
    const [touched, setTouched] = useState(false);
    const [intervalSec, setIntervalSec] = useState(CLOUD_DEFAULTS.intervalSec);

    const email = config && config.user ? config.user.email : null;
    const minInterval = config && config.limits ? config.limits.minIntervalSec : CLOUD_DEFAULTS.minIntervalSec;

    const failPhase = err => {
        if (err.status === 401 || err.code === 'unauthenticated') {
            setPhase('signed_out');
        } else if (err.code === 'disabled') {
            setPhase('disabled');
        } else if (err.code === 'not_in_pilot') {
            setPhase('not_in_pilot');
        } else if (err.code === 'offline') {
            setPhase('offline');
        } else {
            setPhase('unreachable');
            setPhaseNote(errorText(err));
        }
    };

    const load = useCallback(async () => {
        // A slow earlier attempt must not overwrite the result of a newer one.
        const seq = ++loadSeq.current;
        const stale = () => seq !== loadSeq.current;
        setPhase('loading');
        setError('');
        setPhaseNote('');
        let cfg;
        try {
            cfg = await iotApi.config();
        } catch (err) {
            if (!stale()) {
                failPhase(err);
            }
            return;
        }
        if (stale()) {
            return;
        }
        setConfig(cfg);
        if (!cfg.allowed) {
            setPhase('not_in_pilot');
            return;
        }
        if (!cfg.enabled) {
            setPhase('disabled');
            return;
        }
        let list = [];
        try {
            const res = await iotApi.listDevices();
            list = res.devices || [];
        } catch (err) {
            if (!stale()) {
                failPhase(err);
            }
            return;
        }
        if (stale()) {
            return;
        }
        const userEmail = cfg.user ? cfg.user.email : null;
        const sameUser = cloud && cloud.email === userEmail;
        const last = sameUser ? cloud : readLastDevice(userEmail);
        const pick = last && list.some(d => d.id === last.deviceId) ? last.deviceId : (list.length === 1 ? list[0].id : '');
        const picked = list.find(d => d.id === pick);
        setDevices(list);
        setDeviceId(pick);
        if (last && last.deviceId && !picked) {
            setError('The device this project used was deleted. Pick another one or make a new one.');
        }
        setWifi(readWifi(userEmail));
        const fallback = (cfg.limits && cfg.limits.defaultIntervalSec) || CLOUD_DEFAULTS.intervalSec;
        setIntervalSec(clampInterval(
            (sameUser && cloud.intervalSec) || (picked && picked.intervalSec) || fallback,
            (cfg.limits && cfg.limits.minIntervalSec) || CLOUD_DEFAULTS.minIntervalSec
        ));
        setPhase('ready');
    }, [cloud]);

    useEffect(() => {
        if (showCloudSetup) {
            setTouched(false);
            setShowPass(false);
            setNewName((projectName || 'My board').slice(0, 40));
            load();
        }
        // Reload only when the dialog opens, not on every Studio state change.
    }, [showCloudSetup]);

    useEffect(() => {
        if (!showCloudSetup || (phase !== 'offline' && phase !== 'unreachable')) {
            return undefined;
        }
        window.addEventListener('online', load);
        return () => window.removeEventListener('online', load);
    }, [showCloudSetup, phase, load]);

    const selected = devices.find(d => d.id === deviceId) || null;
    const hasToken = useMemo(
        () => Boolean(selected && DEVICE_TOKEN_RE.test(readToken(email, selected.id) || '')),
        // tokenVersion forces a re-read after create/regenerate writes to storage.
        [selected, email, tokenVersion]
    );
    const wifiCheck = validateWifi(wifi);
    const maxDevices = config && config.limits ? config.limits.maxDevices : 0;

    if (!showCloudSetup) {
        return null;
    }

    const close = () => setShowCloudSetup(false);

    const run = async (label, fn) => {
        setBusy(label);
        setError('');
        try {
            await fn();
        } catch (err) {
            if (err.status === 401 || err.code === 'unauthenticated') {
                setPhase('signed_out');
            } else if (err.code === 'disabled') {
                setPhase('disabled');
            } else if (err.code === 'not_found' && label !== 'create') {
                // Deleted from the dashboard (or another tab) while this dialog was open.
                setDevices(prev => prev.filter(d => d.id !== deviceId));
                setDeviceId('');
                setError('That board was deleted. Pick another one or make a new one.');
            } else {
                setError(errorText(err));
            }
        } finally {
            setBusy('');
        }
    };

    const createDevice = () => run('create', async () => {
        const name = newName.trim();
        if (!name) {
            setError('Give the board a name first.');
            return;
        }
        const res = await iotApi.createDevice(name);
        if (!writeToken(email, res.device.id, res.token)) {
            setError('This browser would not save the device key (private window?). Uploads will need a new key.');
        }
        setDevices(prev => prev.concat([Object.assign({latest: []}, res.device)]));
        setDeviceId(res.device.id);
        setTokenVersion(v => v + 1);
    });

    const regenerate = () => run('token', async () => {
        const res = await iotApi.regenerateToken(selected.id);
        writeToken(email, selected.id, res.token);
        setTokenVersion(v => v + 1);
    });

    const enable = () => run('enable', async () => {
        const res = await iotApi.enableDevice(selected.id);
        setDevices(prev => prev.map(d => (d.id === res.device.id ? Object.assign({}, d, res.device) : d)));
    });

    const save = () => run('save', async () => {
        setTouched(true);
        if (!selected) {
            setError('Pick a device or make a new one.');
            return;
        }
        if (!hasToken) {
            setError('This computer needs the device key first — press “Get a new key”.');
            return;
        }
        if (!wifiCheck.ok) {
            return;
        }
        if (selected.intervalSec !== intervalSec) {
            // The server uses the interval to decide when a quiet board counts as offline.
            const res = await iotApi.updateDevice(selected.id, {intervalSec});
            setDevices(prev => prev.map(d => (d.id === res.device.id ? Object.assign({}, d, res.device) : d)));
        }
        writeWifi(email, wifi, wifi.remember);
        const next = {
            deviceId: selected.id,
            deviceName: selected.name,
            intervalSec,
            ssid: wifi.ssid,
            email,
            host: config.broker.host,
            mqttsPort: config.broker.mqttsPort,
            wssPath: config.broker.wssPath,
            minIntervalSec: minInterval
        };
        writeLastDevice(email, next);
        setCloud(next);
        const keys = telemetryReadings(connections, program).map(r => r.key);
        iotApi.suggestDashboard(selected.id, keys, usedCloudControls(program)).catch(() => {});
        close();
    });

    const turnOff = () => {
        setCloud(null);
        close();
    };

    const forget = () => {
        if (!window.confirm('Forget the WiFi password and all device keys saved on this computer?')) {
            return;
        }
        forgetAll(email);
        setWifi({ssid: '', password: '', remember: false});
        setTokenVersion(v => v + 1);
        writeLastDevice(email, null);
        setCloud(null);
    };

    const label = {fontSize: 11, fontWeight: 700, color: K.muted, display: 'block', marginBottom: 4};
    const input = {
        width: '100%',
        boxSizing: 'border-box',
        background: K.canvas,
        border: `1px solid ${K.border}`,
        borderRadius: 8,
        color: K.text,
        padding: '8px 10px',
        fontSize: 13
    };
    const button = (primary, disabled) => ({
        border: primary ? 'none' : `1px solid ${K.border}`,
        background: primary ? K.accent : K.surface,
        color: primary ? '#fff' : K.text,
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1
    });
    const section = {
        border: `1px solid ${K.border}`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        background: K.surface
    };
    const note = color => ({
        fontSize: 12,
        color: K.text,
        background: `${color}1f`,
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: '8px 10px',
        marginTop: 8,
        lineHeight: 1.45
    });

    const message = (title, body, action) => (
        <div style={{fontSize: 13, color: K.sub, lineHeight: 1.5}}>
            <div style={{fontWeight: 700, color: K.text, marginBottom: 6}}>{title}</div>
            <div>{body}</div>
            {action ? <div style={{marginTop: 12}}>{action}</div> : null}
        </div>
    );

    let content;
    if (phase === 'loading') {
        content = <div style={{fontSize: 13, color: K.sub}}>Connecting to TinkerBit Cloud…</div>;
    } else if (phase === 'signed_out') {
        content = message(
            'Sign in to use Cloud',
            isLocalHost() ?
                'You are running Studio locally without the sign-in service, so Cloud is off. Everything else works.' :
                'Cloud keeps your boards under your account, so you need to be signed in.',
            isLocalHost() ? null : (
                <a
                    href={`/login?next=${encodeURIComponent('/beginner')}`}
                    style={Object.assign(button(true, false), {textDecoration: 'none', display: 'inline-block'})}
                >
                    Sign in
                </a>
            )
        );
    } else if (phase === 'offline') {
        content = message(
            'You are offline',
            'Reconnect to the internet. This will try again by itself as soon as you are back online.',
            <button type="button" style={button(true, false)} onClick={load}>Try again</button>
        );
    } else if (phase === 'unreachable') {
        content = message(
            'TinkerBit Cloud is not reachable right now',
            isLocalHost() ?
                'The Cloud service is not running. Start it with “npm run dev” in services/iot-api, then retry.' :
                (
                    <React.Fragment>
                        <div>{phaseNote || errorText('unavailable')}</div>
                        <div style={{marginTop: 8}}>
                            Everything else in Studio still works: you can keep building and upload programs
                            that do not use Cloud.
                        </div>
                    </React.Fragment>
                ),
            <button type="button" style={button(true, false)} onClick={load}>Try again</button>
        );
    } else if (phase === 'disabled') {
        content = message(
            'Cloud is paused',
            'TinkerBit Cloud is down for maintenance. Your boards keep running their programs and reconnect by themselves.',
            <button type="button" style={button(false, false)} onClick={load}>Check again</button>
        );
    } else if (phase === 'not_in_pilot') {
        content = message(
            'Cloud is in a private pilot',
            `Your account${email ? ` (${email})` : ''} is not on the pilot list yet. Ask your teacher to add it.`
        );
    } else {
        const atLimit = maxDevices > 0 && devices.length >= maxDevices;
        content = (
            <div>
                <div style={section}>
                    <span style={label}>1 · Which board is this?</span>
                    {devices.length ? (
                        <div role="radiogroup" aria-label="Your Cloud devices" style={{display: 'grid', gap: 6}}>
                            {devices.map(d => (
                                <label
                                    key={d.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '7px 9px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        border: `1px solid ${d.id === deviceId ? K.accent : K.border}`,
                                        background: d.id === deviceId ? `${K.accent}18` : K.panel
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="tb-cloud-device"
                                        checked={d.id === deviceId}
                                        onChange={() => {
                                            setDeviceId(d.id);
                                            setError('');
                                        }}
                                    />
                                    <span
                                        aria-hidden="true"
                                        style={{width: 8, height: 8, borderRadius: 4, background: statusColor(K, d.status)}}
                                    />
                                    <span style={{flex: 1, fontSize: 13, color: K.text}}>{d.name}</span>
                                    <span style={{fontSize: 11, color: K.dim}}>{d.status}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div style={{fontSize: 12, color: K.sub}}>No boards yet — make your first one below.</div>
                    )}
                    <div style={{display: 'flex', gap: 8, marginTop: 10}}>
                        <input
                            value={newName}
                            maxLength={40}
                            onChange={e => setNewName(e.target.value)}
                            aria-label="New board name"
                            placeholder="New board name"
                            style={Object.assign({}, input, {flex: 1})}
                        />
                        <button
                            type="button"
                            disabled={Boolean(busy) || atLimit}
                            onClick={createDevice}
                            style={button(!devices.length, Boolean(busy) || atLimit)}
                        >
                            {busy === 'create' ? 'Making…' : 'New board'}
                        </button>
                    </div>
                    {atLimit ? (
                        <div style={{fontSize: 11, color: K.dim, marginTop: 6}}>
                            You have {devices.length} of {maxDevices} boards. Delete one on the dashboard to add more.
                        </div>
                    ) : null}
                    {selected && selected.status === 'disabled' ? (
                        <div style={note(K.red)}>
                            This board was turned off{selected.disabledReason ? ` (${selected.disabledReason})` : ''}.
                            {' '}
                            <button type="button" style={button(false, Boolean(busy))} disabled={Boolean(busy)} onClick={enable}>
                                Turn it back on
                            </button>
                        </div>
                    ) : null}
                    {selected && !hasToken ? (
                        <div style={note(K.orange)}>
                            This computer does not have the key for “{selected.name}”. A new key works right away,
                            but a board still running the old key goes offline until you upload again.
                            <div style={{marginTop: 8}}>
                                <button type="button" style={button(true, Boolean(busy))} disabled={Boolean(busy)} onClick={regenerate}>
                                    {busy === 'token' ? 'Getting key…' : 'Get a new key'}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div style={section}>
                    <span style={label}>2 · WiFi the board should join</span>
                    <div style={{display: 'grid', gap: 8}}>
                        <div>
                            <input
                                value={wifi.ssid}
                                onChange={e => setWifi(Object.assign({}, wifi, {ssid: e.target.value}))}
                                onBlur={() => setTouched(true)}
                                aria-label="WiFi name"
                                placeholder="WiFi name (exactly as your phone shows it)"
                                autoComplete="off"
                                spellCheck={false}
                                style={input}
                            />
                            {touched && wifiCheck.errors.ssid ? (
                                <div style={{fontSize: 11, color: K.red, marginTop: 4}}>{wifiCheck.errors.ssid}</div>
                            ) : null}
                        </div>
                        <div>
                            <div style={{display: 'flex', gap: 6}}>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={wifi.password}
                                    onChange={e => setWifi(Object.assign({}, wifi, {password: e.target.value}))}
                                    onBlur={() => setTouched(true)}
                                    aria-label="WiFi password"
                                    placeholder="WiFi password (leave empty for open WiFi)"
                                    autoComplete="new-password"
                                    spellCheck={false}
                                    style={Object.assign({}, input, {flex: 1})}
                                />
                                <button type="button" style={button(false, false)} onClick={() => setShowPass(!showPass)}>
                                    {showPass ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {touched && wifiCheck.errors.password ? (
                                <div style={{fontSize: 11, color: K.red, marginTop: 4}}>{wifiCheck.errors.password}</div>
                            ) : null}
                        </div>
                        <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: K.sub}}>
                            <input
                                type="checkbox"
                                checked={wifi.remember}
                                onChange={e => setWifi(Object.assign({}, wifi, {remember: e.target.checked}))}
                            />
                            Remember on this computer (leave off on shared computers)
                        </label>
                    </div>
                    <div style={{fontSize: 11, color: K.dim, marginTop: 8, lineHeight: 1.5}}>
                        The ESP32 only sees 2.4 GHz WiFi. School WiFi with a login page or a username
                        (eduroam, WPA2-Enterprise) will not work — use a phone hotspot instead.
                        The password goes only into your board; it is never stored on our servers.
                    </div>
                </div>

                <div style={section}>
                    <span style={label}>3 · Send readings</span>
                    <select
                        value={intervalSec}
                        onChange={e => setIntervalSec(Number(e.target.value))}
                        aria-label="How often to send readings"
                        style={Object.assign({}, input, {width: 'auto'})}
                    >
                        {INTERVALS.filter(s => s >= minInterval).map(s => (
                            <option key={s} value={s}>{intervalLabel(s)}</option>
                        ))}
                    </select>
                    <div style={{fontSize: 11, color: K.dim, marginTop: 6}}>
                        Dashboard switches and sliders reach the board instantly, whatever you pick here.
                    </div>
                </div>

                {!hasCloud(connections) ? (
                    <div style={note(K.orange)}>
                        Add the “TinkerBit Cloud” part from the Cloud shelf so your program can use WiFi.
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <Modal title="TinkerBit Cloud" onClose={close} width={560}>
            {content}
            {error ? <div role="alert" style={note(K.red)}>{error}</div> : null}
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap'}}>
                {phase === 'ready' ? (
                    <React.Fragment>
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={save}
                            style={button(true, Boolean(busy))}
                        >
                            {busy === 'save' ? 'Saving…' : 'Use this board'}
                        </button>
                        {selected ? (
                            <a
                                href={`/iot/d/${encodeURIComponent(selected.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{fontSize: 12, color: K.accent}}
                            >
                                Open dashboard
                            </a>
                        ) : null}
                        <div style={{flex: 1}} />
                        {cloud ? (
                            <button type="button" style={button(false, false)} onClick={turnOff}>
                                Unlink project
                            </button>
                        ) : null}
                        <button type="button" style={button(false, false)} onClick={forget}>
                            Forget on this computer
                        </button>
                    </React.Fragment>
                ) : null}
            </div>
        </Modal>
    );
};

export default CloudSetupModal;
