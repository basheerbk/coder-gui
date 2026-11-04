import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';

import QrCode from './QrCode.jsx';
import {Button, Footer, Note, Spacer, ui} from './wizardUi.jsx';

const isLocalHost = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const dashboardUrl = id => `${window.location.origin}/iot/d/${encodeURIComponent(id)}`;

const Mark = ({K, state}) => {
    const look = {
        done: {bg: K.green, fg: '#fff', text: '✓'},
        failed: {bg: K.red, fg: '#fff', text: '!'},
        active: {bg: `${K.accent}33`, fg: K.accent, text: '•'},
        waiting: {bg: K.surface, fg: K.dim, text: ''}
    }[state] || {bg: K.surface, fg: K.dim, text: ''};
    return (
        <span
            aria-hidden="true"
            style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                flexShrink: 0,
                background: look.bg,
                color: look.fg,
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: state === 'active' ? 'tbDotBlink 1.2s ease-in-out infinite' : 'none'
            }}
        >
            {look.text}
        </span>
    );
};

const STATE_WORDS = {done: 'done', failed: 'needs help', active: 'in progress', waiting: 'waiting'};

/**
 * The going-live checklist while a freshly uploaded board joins WiFi and Cloud.
 * @param {object} props.w setup state and actions from useCloudSetup
 */
const LiveStep = ({w}) => {
    const {K} = useStudio();
    const {cloudLive} = useUpload();
    const s = ui(K);
    const {progress} = cloudLive;
    const ssid = w.wifi.ssid;

    const steps = [
        {label: 'Program is on the board', state: 'done'},
        {label: `Join the WiFi “${ssid || 'your WiFi'}”`, state: progress.wifi},
        {label: 'Connect to TinkerBit Cloud', state: progress.cloud},
        {label: 'Show up on your dashboard', state: progress.live === 'done' ? 'done' : (progress.cloud === 'done' ? 'active' : 'waiting')}
    ];
    if (progress.wifi === 'waiting' && !progress.problem) {
        steps[1].state = 'active';
    }

    const problem = {
        wifi_not_found: {
            title: `The board cannot find “${ssid}”`,
            text: 'Check the spelling (capitals matter). The board only sees 2.4 GHz WiFi; a phone hotspot works well.',
            action: <Button K={K} kind="primary" onClick={w.fixWifi}>Change WiFi</Button>
        },
        wifi_password: {
            title: 'The WiFi password looks wrong',
            text: 'Type it again, then upload again.',
            action: <Button K={K} kind="primary" onClick={w.fixWifi}>Change WiFi</Button>
        },
        cloud_rejected: {
            title: 'Cloud did not accept the board’s key',
            text: 'The key was probably replaced on another computer. Make a new key here, then upload again.',
            action: <Button K={K} kind="primary" onClick={w.newKeyAndUpload}>Make a new key</Button>
        },
        no_memory: {
            title: 'The program is too big to run Cloud',
            text: 'Remove some blocks or parts, then upload again.',
            action: null
        },
        timeout: {
            title: 'This is taking longer than usual',
            text: 'Is the board still plugged in? Press its RST button to restart it. Check the WiFi name and password, ' +
                'and use a 2.4 GHz WiFi or a phone hotspot.',
            action: <Button K={K} onClick={w.fixWifi}>Check WiFi</Button>
        }
    }[progress.problem];

    return (
        <div>
            <h3 style={s.title}>Going live…</h3>
            <p style={s.lead}>Keep the board powered. This usually takes under 30 seconds.</p>
            <ol aria-live="polite" style={{listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10}}>
                {steps.map(step => (
                    <li
                        key={step.label}
                        aria-label={`${step.label}: ${STATE_WORDS[step.state]}`}
                        style={{display: 'flex', alignItems: 'center', gap: 10}}
                    >
                        <Mark K={K} state={step.state} />
                        <span style={{fontSize: 14, color: step.state === 'waiting' ? K.dim : K.text}}>{step.label}</span>
                    </li>
                ))}
            </ol>
            {problem ? (
                <Note K={K} tone={progress.problem === 'timeout' ? 'orange' : 'red'} title={problem.title} actions={problem.action}>
                    {problem.text}
                </Note>
            ) : null}
            <Footer>
                <Button K={K} onClick={w.goUpload}>Upload again</Button>
                <Spacer />
                <Button K={K} onClick={cloudLive.dismiss}>Stop waiting</Button>
            </Footer>
        </div>
    );
};

const PhoneLink = ({K, id, name}) => {
    const url = dashboardUrl(id);
    return (
        <div style={{display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap'}}>
            <QrCode text={url} label={`QR code that opens the dashboard for ${name}`} />
            <div style={{flex: '1 1 180px', fontSize: 13, color: K.sub, lineHeight: 1.5}}>
                <div>Sign in on your phone with the same account.</div>
                {isLocalHost() ? (
                    <div style={{color: K.orange, marginTop: 6}}>
                        This is a local test address, so a phone cannot open it.
                    </div>
                ) : null}
                <a
                    href={`/iot/d/${encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{display: 'inline-block', marginTop: 8, color: K.accent, fontWeight: 700}}
                >
                    Open dashboard here
                </a>
            </div>
        </div>
    );
};

export {PhoneLink};
export default LiveStep;
