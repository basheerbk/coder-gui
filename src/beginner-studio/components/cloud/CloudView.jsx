import React, {Suspense, useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {keyTitles} from '../../domain/cloudPanel';
import {writeToken} from '../../domain/cloudSecrets';
import useCloudSetup from '../../hooks/useCloudSetup';
import {errorText, iotApi} from '../../../lib/iot-api';
import {useWidth} from '../../../iot/hooks';
import {canLeave} from '../../../iot/router';
import {useCloudStore} from '../../../iot/store';
import {ThemeContext} from '../../../iot/ui.jsx';

import BoardStep from './BoardStep.jsx';
import DeviceDashboard from './DeviceDashboardLazy';
import DeviceManager, {PROJECT} from './DeviceManager.jsx';
import LiveStep from './LiveStep.jsx';
import UploadStep from './UploadStep.jsx';
import WifiStep from './WifiStep.jsx';
import {Button, Note, StepBar, ui} from './wizardUi.jsx';

/** Below this width the board list turns into a dropdown above the dashboard. */
const NARROW = 900;

const isLocalHost = () => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
};

const SetupCard = ({K, children}) => (
    <div
        style={{
            background: K.panel,
            border: `1px solid ${K.border}`,
            borderRadius: 14,
            padding: 20,
            maxWidth: 560,
            margin: '0 auto'
        }}
    >
        {children}
    </div>
);

/** Ticks so "seen 5 min ago" keeps moving between updates. */
const useNow = ms => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [ms]);
    return now;
};

/**
 * The IoT page once Cloud is reachable: the board list on the left, and on the right either the
 * project's setup steps, its going-live checklist, or a board's dashboard.
 */
const CloudBoards = ({K, w, step, error, cloudLive}) => {
    const {connections} = useStudio();
    const now = useNow(15000);
    const [selected, setSelected] = useState(PROJECT);
    const [editing, setEditing] = useState(false);
    const wrapRef = useRef(null);
    const width = useWidth(wrapRef);
    const narrow = width > 0 && width < NARROW;

    const projectId = w.cloud ? w.cloud.deviceId : null;
    const settingUp = !(step === 'live' && w.cloud && cloudLive.stage !== 'waiting');
    // Picked or just made on the Board step; the project links to it when the WiFi step is saved.
    const setupBoard = settingUp && step === 'wifi' && w.selected && w.selected.id !== projectId ? w.selected : null;
    const projectView = selected === PROJECT || (!setupBoard && selected === projectId);
    let shownId = null;
    if (!projectView) {
        shownId = selected;
    } else if (!settingUp) {
        shownId = projectId;
    }
    const route = useMemo(() => (shownId ? {page: 'device', id: shownId} : {page: 'devices'}), [shownId]);
    const [state, actions] = useCloudStore(route);
    const devices = state.devices;
    const email = state.config && state.config.user ? state.config.user.email : null;
    const limit = state.config && state.config.limits ? state.config.limits.maxDevices : 0;
    const projectDevice = devices && projectId ? devices.find(d => d.id === projectId) : null;
    let projectBoard = '';
    if (setupBoard) {
        projectBoard = setupBoard.name;
    } else if (projectId) {
        projectBoard = projectDevice ? projectDevice.name : w.cloud.deviceName;
    }
    const titleFor = useMemo(() => keyTitles(connections), [connections]);

    const select = target => {
        const next = target === projectId && !setupBoard ? PROJECT : target;
        if (next === selected || !canLeave()) {
            return;
        }
        setSelected(next);
    };

    // An upload always goes to the project's board, so show that board while it happens.
    useEffect(() => {
        if ((cloudLive.stage === 'uploading' || cloudLive.stage === 'waiting') && canLeave()) {
            setSelected(PROJECT);
        }
    }, [cloudLive.stage]);

    // The project switched boards (setup finished): show it, and refresh the list. The store
    // loads the list by itself when the page opens, so the first run has nothing to do.
    const mounted = useRef(false);
    useEffect(() => {
        if (mounted.current) {
            setSelected(PROJECT);
            actions.refreshDevices();
        }
    }, [projectId]);

    // The setup steps made or deleted a board.
    useEffect(() => {
        if (mounted.current) {
            actions.refreshDevices();
        }
        mounted.current = true;
    }, [w.devices.length]);

    // The board on show was deleted here or on another screen.
    useEffect(() => {
        if (selected !== PROJECT && devices && !devices.some(d => d.id === selected)) {
            setSelected(PROJECT);
        }
    }, [devices, selected]);

    const addBoard = async name => {
        try {
            const res = await iotApi.createDevice(name);
            const saved = writeToken(email, res.device.id, res.token);
            actions.dispatch({type: 'device/upsert', device: Object.assign({latest: []}, res.device)});
            w.refreshDevices();
            w.tokenChanged();
            if (canLeave()) {
                setSelected(res.device.id);
            }
            return saved ? '' : 'Board added, but this browser would not save its key (private window?). Use a normal window.';
        } catch (err) {
            return errorText(err);
        }
    };

    const linkToProject = id => {
        if (id === projectId) {
            // Back to the board the project already uses: drop the half-done switch.
            w.close();
            setSelected(PROJECT);
            return;
        }
        const board = devices && devices.find(d => d.id === id);
        const name = board ? board.name : 'this board';
        // eslint-disable-next-line no-alert
        if (projectDevice && !window.confirm(
            `Your next Upload goes to “${name}”.\n“${projectDevice.name}” keeps running its old program.`
        )) {
            return;
        }
        if (!canLeave()) {
            return;
        }
        w.switchBoard(id);
        w.refreshDevices();
        setSelected(PROJECT);
    };

    const onDeleted = id => {
        if (id === projectId) {
            w.unlink();
        }
        setSelected(PROJECT);
        w.refreshDevices();
    };

    let right;
    if (projectView && settingUp) {
        const shown = step === 'live' && !w.cloud ? 'board' : step;
        const body = {
            board: <BoardStep w={w} />,
            wifi: <WifiStep w={w} />,
            upload: <UploadStep w={w} />,
            live: <LiveStep w={w} />
        }[shown];
        right = (
            <SetupCard K={K}>
                <StepBar K={K} step={shown} />
                {body}
            </SetupCard>
        );
    } else {
        right = (
            <Suspense fallback={<div style={{fontSize: 13, color: K.sub, padding: 12}}>Loading the dashboard…</div>}>
                <DeviceDashboard
                    K={K}
                    id={shownId}
                    state={state}
                    actions={actions}
                    isProject={projectView}
                    projectBoard={projectBoard}
                    projectGone={Boolean(!setupBoard && projectId && devices && !projectDevice)}
                    now={now}
                    titleFor={projectView ? titleFor : null}
                    onUpload={w.goUpload}
                    onChangeWifi={w.fixWifi}
                    onChangeBoard={w.goBoard}
                    onBack={() => select(PROJECT)}
                    onUseForProject={() => linkToProject(shownId)}
                    onUnlinkDeleted={w.unlink}
                    onDeleted={onDeleted}
                    onNewKey={w.tokenChanged}
                    onChanged={w.deviceChanged}
                    onEditingChange={setEditing}
                />
            </Suspense>
        );
    }

    let mode = 'full';
    if (narrow) {
        mode = 'narrow';
    } else if (editing) {
        mode = 'rail';
    } else if (devices && devices.length <= 1) {
        mode = 'compact';
    }
    const columns = {full: 'minmax(260px, 30%) minmax(0, 1fr)', compact: '230px minmax(0, 1fr)', rail: '52px minmax(0, 1fr)'}[mode];
    let phoneId = null;
    if (!projectView) {
        phoneId = selected;
    } else if (projectDevice) {
        phoneId = projectId;
    }
    const phoneBoard = phoneId && devices ? devices.find(d => d.id === phoneId) : null;

    return (
        <ThemeContext.Provider value={K}>
            <div
                ref={wrapRef}
                style={narrow ?
                    {display: 'grid', gap: 12} :
                    {display: 'grid', gridTemplateColumns: columns, gap: 16, alignItems: 'start'}}
            >
                <div style={narrow ? null : {position: 'sticky', top: 0, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto'}}>
                    <DeviceManager
                        K={K}
                        mode={mode}
                        devices={devices}
                        devicesError={state.devicesError}
                        onRetry={actions.refreshDevices}
                        limit={limit}
                        project={setupBoard ?
                            {id: setupBoard.id, name: setupBoard.name, settingUp: true} :
                            {id: projectId, name: w.cloud ? w.cloud.deviceName : ''}}
                        selected={projectView ? PROJECT : selected}
                        onSelect={select}
                        onAdd={addBoard}
                        phone={phoneBoard ? {id: phoneBoard.id, name: phoneBoard.name} : null}
                        now={now}
                    />
                </div>
                <div style={{minWidth: 0}}>
                    {error && projectView ? <Note K={K} tone="red" title={error} /> : null}
                    {error && projectView ? <div style={{height: 10}} /> : null}
                    {right}
                </div>
            </div>
        </ThemeContext.Provider>
    );
};

/**
 * The IoT Dashboard page: setup steps until the board is linked, then the board list and dashboards.
 * Stays mounted (but draws nothing) on the other tabs so a half-typed WiFi password survives.
 */
const CloudView = () => {
    const studio = useStudio();
    const {K, view, setView} = studio;
    const {cloudLive} = useUpload();
    const active = view === 'cloud';
    const {phase, phaseNote, step, error, email, load, w} = useCloudSetup({studio, cloudLive, active});

    // First upload of a never-seen board from the top bar: show the student the checklist.
    useEffect(() => {
        if (!active && cloudLive.stage === 'waiting' && cloudLive.device && cloudLive.device.status === 'never') {
            setView('cloud');
        }
    }, [cloudLive.stage]);

    if (!active) {
        return null;
    }

    const s = ui(K);
    const message = (title, body, action) => (
        <SetupCard K={K}>
            <h3 style={s.title}>{title}</h3>
            <div style={s.lead}>{body}</div>
            {action}
        </SetupCard>
    );

    let content;
    if (phase === 'loading' || !step) {
        content = <div style={{fontSize: 13, color: K.sub, textAlign: 'center'}}>Opening your IoT Dashboard…</div>;
    } else if (phase === 'signed_out') {
        content = message(
            'Sign in to use the IoT Dashboard',
            isLocalHost() ?
                'You are running Studio locally without the sign-in service, so the IoT Dashboard is off. Everything else works.' :
                'The IoT Dashboard keeps your boards under your account, so you need to be signed in.',
            isLocalHost() ? null : (
                <a href={`/login?next=${encodeURIComponent('/beginner')}`} style={{color: K.accent, fontWeight: 700}}>
                    Sign in
                </a>
            )
        );
    } else if (phase === 'offline') {
        content = message(
            'You are offline',
            'Reconnect to the internet. This tries again by itself as soon as you are back online.',
            <Button K={K} kind="primary" onClick={() => load()}>Try again</Button>
        );
    } else if (phase === 'unreachable') {
        content = message(
            'The IoT Dashboard cannot connect right now',
            isLocalHost() ?
                'The Cloud service is not running. Start it with “npm start” in services/iot-api, then retry.' :
                `${phaseNote || 'TinkerBit Cloud is not available right now.'} Everything else in Studio still works.`,
            <Button K={K} kind="primary" onClick={() => load()}>Try again</Button>
        );
    } else if (phase === 'disabled') {
        content = message(
            'The IoT Dashboard is paused',
            'TinkerBit Cloud is down for maintenance. Your boards keep running their programs and reconnect by themselves.',
            <Button K={K} onClick={() => load()}>Check again</Button>
        );
    } else if (phase === 'not_in_pilot') {
        content = message(
            'The IoT Dashboard is in a private pilot',
            `Your account${email ? ` (${email})` : ''} is not on the pilot list yet. Ask your teacher to add it.`
        );
    }

    return (
        <main
            aria-label="IoT Dashboard"
            style={{flex: 1, minHeight: 0, overflow: 'auto', background: K.canvas}}
        >
            {content ? (
                <div style={{maxWidth: 820, margin: '0 auto', padding: '20px 16px 40px'}}>
                    {content}
                    {error ? (
                        <div style={{maxWidth: 560, margin: '0 auto'}}>
                            <Note K={K} tone="red" title={error} />
                        </div>
                    ) : null}
                </div>
            ) : (
                <div style={{maxWidth: 1400, margin: '0 auto', padding: '16px 16px 40px'}}>
                    <CloudBoards K={K} w={w} step={step} error={error} cloudLive={cloudLive} />
                </div>
            )}
        </main>
    );
};

export {CloudBoards};
export default CloudView;
