import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {CLOUD_DEFAULTS, DEVICE_TOKEN_RE, clampInterval, hasCloud, validateWifi} from '../../domain/cloud';
import {telemetryReadings, usedCloudControls} from '../../domain/cloudFirmware';
import {uniqueBoardName} from '../../domain/cloudProgress';
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

import BoardStep, {NEW} from './BoardStep.jsx';
import LiveStep from './LiveStep.jsx';
import PartStep from './PartStep.jsx';
import UploadStep from './UploadStep.jsx';
import WifiStep from './WifiStep.jsx';
import {Button, Note, StepBar, ui} from './wizardUi.jsx';

const isLocalHost = () => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
};

/**
 * One guided path from "add Cloud" to "live on my phone": Board, WiFi, Upload, Live.
 * `showCloudSetup` is true to open at the right step, or 'live' to open the checklist.
 */
const CloudWizard = () => {
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
    const upload = useUpload();
    const {cloudLive} = upload;
    const open = Boolean(showCloudSetup);
    const cloudPart = hasCloud(connections);

    // phase: loading | signed_out | offline | unreachable | disabled | not_in_pilot | ready
    const [phase, setPhase] = useState('loading');
    const [phaseNote, setPhaseNote] = useState('');
    const loadSeq = useRef(0);
    const [step, setStep] = useState('board');
    const [config, setConfig] = useState(null);
    const [devices, setDevices] = useState([]);
    const [choice, setChoice] = useState('');
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [tokenVersion, setTokenVersion] = useState(0);
    const [wifi, setWifi] = useState({ssid: '', password: '', remember: false});
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
        const lastFound = last && list.some(d => d.id === last.deviceId);
        let pick = NEW;
        if (lastFound) {
            pick = last.deviceId;
        } else if (list.length === 1) {
            pick = list[0].id;
        } else if (list.length) {
            pick = '';
        }
        const picked = list.find(d => d.id === pick);
        setDevices(list);
        setChoice(pick);
        setNewName(uniqueBoardName(projectName || 'My board', list.map(d => d.name)));
        if (last && last.deviceId && !lastFound) {
            setError('The board this project used was deleted. Pick another one or make a new one.');
        }
        setWifi(readWifi(userEmail));
        const fallback = (cfg.limits && cfg.limits.defaultIntervalSec) || CLOUD_DEFAULTS.intervalSec;
        setIntervalSec(clampInterval(
            (sameUser && cloud.intervalSec) || (picked && picked.intervalSec) || fallback,
            (cfg.limits && cfg.limits.minIntervalSec) || CLOUD_DEFAULTS.minIntervalSec
        ));
        setPhase('ready');
    }, [cloud, projectName]);

    useEffect(() => {
        if (!open) {
            return;
        }
        setTouched(false);
        setError('');
        if (!cloudPart) {
            setStep('part');
        } else if (showCloudSetup === 'live' || (cloud && cloudLive.stage !== 'idle')) {
            setStep(cloudLive.stage === 'uploading' ? 'upload' : 'live');
        } else if (cloud && cloudLive.device && cloudLive.device.id === cloud.deviceId &&
            (cloudLive.device.status === 'online' || cloudLive.device.status === 'offline')) {
            setStep('live');
        } else {
            setStep('board');
        }
        load();
        // Reload only when the wizard opens, not on every Studio change.
    }, [open]);

    useEffect(() => {
        if (open && step === 'part' && cloudPart) {
            setStep('board');
        }
    }, [open, step, cloudPart]);

    useEffect(() => {
        if (open && step === 'upload' && (cloudLive.stage === 'waiting' || cloudLive.stage === 'live')) {
            setStep('live');
        }
    }, [open, step, cloudLive.stage]);

    // First upload from the top bar for a board that has never been online: show the checklist.
    useEffect(() => {
        if (!open && cloudLive.stage === 'waiting' && cloudLive.device && cloudLive.device.status === 'never') {
            setShowCloudSetup('live');
        }
    }, [cloudLive.stage]);

    useEffect(() => {
        if (!open || (phase !== 'offline' && phase !== 'unreachable')) {
            return undefined;
        }
        window.addEventListener('online', load);
        return () => window.removeEventListener('online', load);
    }, [open, phase, load]);

    const selected = devices.find(d => d.id === choice) || null;
    const hasToken = useMemo(
        () => Boolean(selected && DEVICE_TOKEN_RE.test(readToken(email, selected.id) || '')),
        // tokenVersion forces a re-read after create/regenerate writes to storage.
        [selected, email, tokenVersion]
    );
    const wifiCheck = validateWifi(wifi);
    const maxDevices = config && config.limits ? config.limits.maxDevices : 0;
    const atLimit = maxDevices > 0 && devices.length >= maxDevices;

    if (!open) {
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
                // Deleted from the dashboard (or another tab) while the wizard was open.
                setDevices(prev => prev.filter(d => d.id !== choice));
                setChoice(devices.length > 1 ? '' : NEW);
                setStep('board');
                setError('That board was deleted. Pick another one or make a new one.');
            } else {
                setError(errorText(err));
            }
        } finally {
            setBusy('');
        }
    };

    const making = choice === NEW || !devices.length;

    const next = () => run(making ? 'create' : 'next', async () => {
        let board = selected;
        if (making) {
            const name = newName.trim();
            if (!name) {
                setError('Give the board a name first.');
                return;
            }
            const res = await iotApi.createDevice(name);
            board = Object.assign({latest: []}, res.device);
            setDevices(prev => prev.concat([board]));
            setChoice(board.id);
            if (!writeToken(email, board.id, res.token)) {
                setError('This browser would not save the board key (private window?). Upload from a normal window.');
            }
            setTokenVersion(v => v + 1);
        } else {
            if (!board) {
                setError('Pick a board, or make a new one.');
                return;
            }
            if (board.status === 'disabled') {
                setError('Turn this board back on first.');
                return;
            }
            if (!hasToken) {
                setError('Make a new key for this board first.');
                return;
            }
        }
        if (board.intervalSec !== intervalSec) {
            // The server uses the interval to decide when a quiet board counts as offline.
            const res = await iotApi.updateDevice(board.id, {intervalSec});
            setDevices(prev => prev.map(d => (d.id === res.device.id ? Object.assign({}, d, res.device) : d)));
        }
        setStep('wifi');
    });

    const saveWifi = () => run('save', async () => {
        setTouched(true);
        if (!selected) {
            setStep('board');
            return;
        }
        if (!wifiCheck.ok) {
            return;
        }
        writeWifi(email, wifi, wifi.remember);
        const link = {
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
        writeLastDevice(email, link);
        setCloud(link);
        const keys = telemetryReadings(connections, program).map(r => r.key);
        iotApi.suggestDashboard(selected.id, keys, usedCloudControls(program)).catch(() => {});
        setStep('upload');
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

    const forget = () => {
        if (!window.confirm('Forget the WiFi password and all board keys saved on this computer?')) {
            return;
        }
        forgetAll(email);
        setWifi({ssid: '', password: '', remember: false});
        setTokenVersion(v => v + 1);
        writeLastDevice(email, null);
        setCloud(null);
    };

    const w = {
        cloud,
        devices,
        choice,
        setChoice: id => {
            setChoice(id);
            setError('');
        },
        newName,
        setNewName,
        selected,
        hasToken,
        busy,
        atLimit,
        maxDevices,
        intervalSec,
        setIntervalSec,
        minInterval,
        wifi,
        setWifi,
        wifiCheck,
        touched,
        setTouched,
        deviceId: cloud ? cloud.deviceId : (selected && selected.id),
        boardName: (selected && selected.name) || (cloud && cloud.deviceName) || newName,
        next,
        saveWifi,
        regenerate,
        enable,
        forget,
        unlink: () => {
            setCloud(null);
            close();
        },
        close,
        back: () => setStep({wifi: 'board', upload: 'wifi', live: 'upload'}[step] || 'board'),
        goUpload: () => setStep('upload'),
        goBoard: () => setStep('board'),
        fixWifi: () => {
            setTouched(true);
            setStep('wifi');
        },
        newKeyAndUpload: () => run('token', async () => {
            const res = await iotApi.regenerateToken(w.deviceId);
            writeToken(email, w.deviceId, res.token);
            setTokenVersion(v => v + 1);
            setStep('upload');
        })
    };

    const s = ui(K);
    const message = (title, body, action) => (
        <div>
            <h3 style={s.title}>{title}</h3>
            <div style={s.lead}>{body}</div>
            {action}
        </div>
    );

    let content;
    if (step === 'part') {
        content = <PartStep onClose={close} />;
    } else if (phase === 'loading') {
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
                    style={{color: K.accent, fontWeight: 700}}
                >
                    Sign in
                </a>
            )
        );
    } else if (phase === 'offline') {
        content = message(
            'You are offline',
            'Reconnect to the internet. This tries again by itself as soon as you are back online.',
            <Button K={K} kind="primary" onClick={load}>Try again</Button>
        );
    } else if (phase === 'unreachable') {
        content = message(
            'TinkerBit Cloud is not reachable right now',
            isLocalHost() ?
                'The Cloud service is not running. Start it with “npm start” in services/iot-api, then retry.' :
                `${phaseNote || errorText('unavailable')} Everything else in Studio still works.`,
            <Button K={K} kind="primary" onClick={load}>Try again</Button>
        );
    } else if (phase === 'disabled') {
        content = message(
            'Cloud is paused',
            'TinkerBit Cloud is down for maintenance. Your boards keep running their programs and reconnect by themselves.',
            <Button K={K} onClick={load}>Check again</Button>
        );
    } else if (phase === 'not_in_pilot') {
        content = message(
            'Cloud is in a private pilot',
            `Your account${email ? ` (${email})` : ''} is not on the pilot list yet. Ask your teacher to add it.`
        );
    } else {
        const body = {
            board: <BoardStep w={w} />,
            wifi: <WifiStep w={w} />,
            upload: <UploadStep w={w} />,
            live: <LiveStep w={w} />
        }[step];
        content = (
            <React.Fragment>
                <StepBar K={K} step={step} />
                {body}
            </React.Fragment>
        );
    }

    return (
        <Modal title="TinkerBit Cloud" onClose={close} width={520}>
            {content}
            {error ? <Note K={K} tone="red" title={error} /> : null}
        </Modal>
    );
};

export default CloudWizard;
