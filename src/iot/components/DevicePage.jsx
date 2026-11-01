import React, {useEffect, useState} from 'react';

import {errorText} from '../../lib/iot-api';
import {rssiBars, timeAgo} from '../format';
import {linkTo} from '../router';
import {Banner, Button, Card, SignalBars, StatusDot, useTheme} from '../ui.jsx';

import DashboardTab from './DashboardTab.jsx';
import DeviceSettings from './DeviceSettings.jsx';
import RulesPanel from './RulesPanel.jsx';

const Onboarding = ({device}) => {
    const K = useTheme();
    return (
        <Card style={{marginBottom: 12}}>
            <div style={{fontWeight: 800, fontSize: 16, marginBottom: 8}}>Waiting for “{device.name}” to connect</div>
            <ol style={{margin: 0, paddingLeft: 20, color: K.sub, fontSize: 14, lineHeight: 1.7}}>
                <li>In <a href="/beginner" style={{color: K.accent}}>Beginner Studio</a>, add the TinkerBit Cloud part and pick this board.</li>
                <li>Type the WiFi name and password, then press Upload.</li>
                <li>Open the Serial monitor: it says “Cloud: online” when the board is connected.</li>
            </ol>
            <div style={{fontSize: 12, color: K.dim, marginTop: 10, lineHeight: 1.5}}>
                Stuck on “WiFi: wrong password” or “no network found”? The ESP32 needs 2.4 GHz WiFi without a login page.
                A phone hotspot is the quickest fix.
            </div>
        </Card>
    );
};

const DevicePage = ({id, state, actions}) => {
    const K = useTheme();
    const detail = state.details[id];
    const loadError = state.detailErrors[id];
    const [tab, setTab] = useState('dashboard');

    useEffect(() => {
        setTab('dashboard');
    }, [id]);

    if (!detail) {
        if (loadError === 'not_found') {
            return (
                <Banner tone="warn" action={<a href="/iot" onClick={linkTo('/iot')} style={{color: K.accent}}>All boards</a>}>
                    This board does not exist anymore (it may have been deleted on another screen).
                </Banner>
            );
        }
        if (loadError) {
            return (
                <Banner tone="error" action={<Button onClick={() => actions.refreshDetail(id)}>Retry</Button>}>
                    {errorText(loadError)}
                </Banner>
            );
        }
        return <div style={{color: K.dim}}>Loading…</div>;
    }

    const device = detail.device;
    const onControl = control => actions.dispatch({type: 'control/update', id, control});

    const tabButton = (key, label) => (
        <button
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            style={{
                border: 'none',
                background: tab === key ? K.accent : 'transparent',
                color: tab === key ? '#fff' : K.sub,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
            }}
        >
            {label}
        </button>
    );

    return (
        <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10}}>
                <a href="/iot" onClick={linkTo('/iot')} style={{color: K.dim, fontSize: 13, textDecoration: 'none'}}>← Boards</a>
                <StatusDot status={device.status} size={12} />
                <h1 style={{fontSize: 21, margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {device.name}
                </h1>
                <span style={{fontSize: 12, color: K.dim, display: 'flex', alignItems: 'center', gap: 6}}>
                    {device.status === 'online' && device.rssi !== null ? <SignalBars bars={rssiBars(device.rssi)} /> : null}
                    {device.status === 'online' ? 'Online' : (device.status === 'disabled' ? 'Paused' : `Last seen ${timeAgo(device.lastSeen)}`)}
                </span>
            </div>

            <div style={{display: 'flex', gap: 4, background: K.panel, border: `1px solid ${K.border}`, borderRadius: 10, padding: 3, marginBottom: 12, width: 'fit-content', maxWidth: '100%', overflowX: 'auto'}}>
                {tabButton('dashboard', 'Dashboard')}
                {tabButton('rules', detail.rules.length ?
                    `Alerts · ${detail.rules.length} rule${detail.rules.length === 1 ? '' : 's'}` : 'Alerts')}
                {tabButton('settings', 'Settings')}
            </div>

            {device.status === 'disabled' && tab !== 'settings' ? (
                <Banner tone="error" action={<Button onClick={() => setTab('settings')}>Fix it</Button>}>
                    This board is paused and cannot connect.
                </Banner>
            ) : null}

            {tab === 'dashboard' && !device.lastSeen ? <Onboarding device={device} /> : null}

            {/* Stays mounted while another tab is open, so an unsaved dashboard edit is not lost. */}
            <div style={{display: tab === 'dashboard' ? 'block' : 'none'}}>
                <DashboardTab key={id} detail={detail} state={state} actions={actions} onControl={onControl} />
            </div>

            {tab === 'rules' ? (
                <RulesPanel detail={detail} onRules={rules => actions.dispatch({type: 'rules/set', id, rules})} />
            ) : null}

            {tab === 'settings' ? <DeviceSettings detail={detail} config={state.config} actions={actions} /> : null}
        </div>
    );
};

export default DevicePage;
