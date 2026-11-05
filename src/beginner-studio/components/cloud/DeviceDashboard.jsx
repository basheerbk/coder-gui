import React, {useEffect, useState} from 'react';

import {errorText} from '../../../lib/iot-api';
import {rssiBars, timeAgo} from '../../../iot/format';
import {Banner, SignalBars, StatusDot} from '../../../iot/ui.jsx';
import DashboardTab from '../../../iot/components/DashboardTab.jsx';
import DeviceSettings from '../../../iot/components/DeviceSettings.jsx';
import RulesPanel from '../../../iot/components/RulesPanel.jsx';

import {Button, Note, ui} from './wizardUi.jsx';

const STATUS_WORDS = {online: 'Online', disabled: 'Paused'};

const statusLine = (device, now) => {
    if (device.status === 'online') {
        return device.onlineSince ? `Came online ${timeAgo(device.onlineSince, now)}` : 'Online';
    }
    if (device.status === 'disabled') {
        return device.disabledReason === 'flooding' ?
            'Paused because it sent messages too fast' :
            (device.disabledReason || 'Paused');
    }
    return device.lastSeen ? `Last seen ${timeAgo(device.lastSeen, now)}` : 'Has not connected yet';
};

const Tab = ({K, active, onClick, children}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        style={{
            border: 'none',
            background: active ? K.accent : 'transparent',
            color: active ? '#fff' : K.sub,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
        }}
    >
        {children}
    </button>
);

/**
 * Right side of the IoT page for one board: who it is, what Upload does, then the same
 * Dashboard / Alerts / Settings as the phone dashboard.
 * isProject: this is the board the project uploads to; otherwise a strip says which board that is.
 */
const DeviceDashboard = ({
    K, id, state, actions, isProject, projectBoard, projectGone, now, titleFor,
    onUpload, onChangeWifi, onChangeBoard, onBack, onUseForProject, onUnlinkDeleted, onDeleted, onNewKey, onChanged,
    onEditingChange
}) => {
    const s = ui(K);
    const [tab, setTab] = useState('dashboard');
    const detail = state.details[id];
    const loadError = state.detailErrors[id];

    useEffect(() => {
        setTab('dashboard');
    }, [id]);

    const lookingAt = name => {
        if (isProject) {
            return null;
        }
        let stripTitle = `You're looking at “${name}”. This project is not linked to a board yet.`;
        if (projectGone) {
            stripTitle = `You're looking at “${name}”. This project's board “${projectBoard}” was deleted.`;
        } else if (projectBoard) {
            stripTitle = `You're looking at “${name}”. This project uploads to “${projectBoard}”.`;
        }
        return (
            <Note
                K={K}
                tone="blue"
                title={stripTitle}
                actions={(
                    <React.Fragment>
                        {projectBoard ? (
                            <Button K={K} onClick={onBack}>{projectGone ? 'Back to this project' : `Back to ${projectBoard}`}</Button>
                        ) : null}
                        <Button K={K} kind="primary" onClick={onUseForProject}>Use “{name}” for this project</Button>
                    </React.Fragment>
                )}
            />
        );
    };

    if (!detail) {
        if (loadError === 'not_found') {
            return (
                <Note
                    K={K}
                    tone="red"
                    title="This board was deleted"
                    actions={isProject ?
                        <Button K={K} kind="primary" onClick={onUnlinkDeleted}>Pick another board</Button> :
                        <Button K={K} onClick={onBack}>Back to this project&apos;s board</Button>}
                >
                    {isProject ?
                        'It was deleted on another screen. Pick another board for this project, or make a new one.' :
                        'It was deleted on another screen.'}
                </Note>
            );
        }
        if (loadError) {
            return (
                <Note
                    K={K}
                    tone="red"
                    title={errorText({code: loadError})}
                    actions={<Button K={K} onClick={() => actions.refreshDetail(id)}>Try again</Button>}
                />
            );
        }
        return <div style={{fontSize: 13, color: K.sub, padding: 12}}>Loading the board…</div>;
    }

    const device = detail.device;
    const never = !device.lastSeen;
    const onControl = control => actions.dispatch({type: 'control/update', id, control});
    const ruleCount = detail.rules.length;

    return (
        <div style={{minWidth: 0}}>
            <section
                aria-label={device.name}
                style={{background: K.panel, border: `1px solid ${K.border}`, borderRadius: 14, padding: 16, marginBottom: 12}}
            >
                <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                    <StatusDot status={device.status} size={12} />
                    <div style={{flex: '1 1 200px', minWidth: 0}}>
                        <h2 style={{fontSize: 18, fontWeight: 800, color: K.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {device.name}
                            <span style={{fontSize: 13, fontWeight: 600, color: K.sub, marginLeft: 8}}>
                                {STATUS_WORDS[device.status] || (never ? '' : 'Offline')}
                            </span>
                        </h2>
                        <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 2}}>
                            <span style={s.small}>{statusLine(device, now)}</span>
                            {device.status === 'online' && typeof device.rssi === 'number' ? <SignalBars bars={rssiBars(device.rssi)} /> : null}
                        </div>
                    </div>
                    {isProject ? (
                        <Button K={K} kind={never ? 'primary' : 'secondary'} onClick={onUpload}>
                            {never ? 'Upload to the board' : 'Upload again'}
                        </Button>
                    ) : null}
                </div>
                {isProject ? (
                    <div style={{display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap'}}>
                        <button type="button" style={s.link} onClick={onChangeWifi}>Change WiFi</button>
                        <button type="button" style={s.link} onClick={onChangeBoard}>Use a different board</button>
                    </div>
                ) : null}
                {lookingAt(device.name)}
                {never ? (
                    <Note
                        K={K}
                        tone="orange"
                        title={isProject ? `Waiting for “${device.name}” to connect` : 'This board has no program yet'}
                    >
                        {isProject ?
                            'Press Upload to the board. It joins your WiFi by itself, then its readings show up here.' :
                            'Use it for this project, then Upload. Its readings show up here once it is online.'}
                    </Note>
                ) : null}
            </section>

            {device.status === 'disabled' && tab !== 'settings' ? (
                <Banner tone="error" action={<Button K={K} onClick={() => setTab('settings')}>Fix it</Button>}>
                    This board is paused and cannot connect.
                </Banner>
            ) : null}

            <div
                role="group"
                aria-label="Board pages"
                style={{
                    display: 'flex',
                    gap: 4,
                    background: K.panel,
                    border: `1px solid ${K.border}`,
                    borderRadius: 10,
                    padding: 3,
                    marginBottom: 12,
                    width: 'fit-content',
                    maxWidth: '100%',
                    overflowX: 'auto'
                }}
            >
                <Tab K={K} active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>Dashboard</Tab>
                <Tab K={K} active={tab === 'rules'} onClick={() => setTab('rules')}>
                    {ruleCount ? `Alerts · ${ruleCount}` : 'Alerts'}
                </Tab>
                <Tab K={K} active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</Tab>
            </div>

            {/* Stays mounted while another tab is open, so an unsaved dashboard edit is not lost. */}
            <div style={{display: tab === 'dashboard' ? 'block' : 'none'}}>
                <DashboardTab
                    key={id}
                    detail={detail}
                    state={state}
                    actions={actions}
                    onControl={onControl}
                    titleFor={titleFor}
                    onEditingChange={onEditingChange}
                />
            </div>

            {tab === 'rules' ? (
                <div>
                    <p style={Object.assign({}, s.lead, {margin: '0 2px 10px'})}>
                        Get a message on your phone when a reading goes above or below a number.
                    </p>
                    <RulesPanel detail={detail} onRules={rules => actions.dispatch({type: 'rules/set', id, rules})} />
                </div>
            ) : null}

            {tab === 'settings' && state.config ? (
                <DeviceSettings
                    key={id}
                    detail={detail}
                    config={state.config}
                    actions={actions}
                    simple
                    onDeleted={onDeleted}
                    onNewKey={onNewKey}
                    onChanged={onChanged}
                    deleteNote={isProject ? 'This project will need a new board after this.' : ''}
                    intervalHint={isProject ? 'Upload again after changing it.' : 'Change it in that board\'s project too, then upload.'}
                />
            ) : null}
        </div>
    );
};

export default DeviceDashboard;
