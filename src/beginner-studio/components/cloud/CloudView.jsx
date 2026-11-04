import React, {useEffect} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import useCloudSetup from '../../hooks/useCloudSetup';

import BoardPanel from './BoardPanel.jsx';
import BoardStep from './BoardStep.jsx';
import LiveStep from './LiveStep.jsx';
import UploadStep from './UploadStep.jsx';
import WifiStep from './WifiStep.jsx';
import {Button, Note, StepBar, ui} from './wizardUi.jsx';

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

/**
 * The Cloud tab: setup steps until the board is linked, then the board's live panel.
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
        content = <div style={{fontSize: 13, color: K.sub, textAlign: 'center'}}>Connecting to TinkerBit Cloud…</div>;
    } else if (phase === 'signed_out') {
        content = message(
            'Sign in to use Cloud',
            isLocalHost() ?
                'You are running Studio locally without the sign-in service, so Cloud is off. Everything else works.' :
                'Cloud keeps your boards under your account, so you need to be signed in.',
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
            'TinkerBit Cloud is not reachable right now',
            isLocalHost() ?
                'The Cloud service is not running. Start it with “npm start” in services/iot-api, then retry.' :
                `${phaseNote || 'TinkerBit Cloud is not available right now.'} Everything else in Studio still works.`,
            <Button K={K} kind="primary" onClick={() => load()}>Try again</Button>
        );
    } else if (phase === 'disabled') {
        content = message(
            'Cloud is paused',
            'TinkerBit Cloud is down for maintenance. Your boards keep running their programs and reconnect by themselves.',
            <Button K={K} onClick={() => load()}>Check again</Button>
        );
    } else if (phase === 'not_in_pilot') {
        content = message(
            'Cloud is in a private pilot',
            `Your account${email ? ` (${email})` : ''} is not on the pilot list yet. Ask your teacher to add it.`
        );
    } else if (step === 'live' && w.cloud && cloudLive.stage !== 'waiting') {
        content = <BoardPanel w={w} />;
    } else {
        const shown = step === 'live' && !w.cloud ? 'board' : step;
        const body = {
            board: <BoardStep w={w} />,
            wifi: <WifiStep w={w} />,
            upload: <UploadStep w={w} />,
            live: <LiveStep w={w} />
        }[shown];
        content = (
            <SetupCard K={K}>
                <StepBar K={K} step={shown} />
                {body}
            </SetupCard>
        );
    }

    return (
        <main
            aria-label="TinkerBit Cloud"
            style={{flex: 1, minHeight: 0, overflow: 'auto', background: K.canvas}}
        >
            <div style={{maxWidth: 820, margin: '0 auto', padding: '20px 16px 40px'}}>
                {content}
                {error ? (
                    <div style={{maxWidth: 560, margin: '0 auto'}}>
                        <Note K={K} tone="red" title={error} />
                    </div>
                ) : null}
            </div>
        </main>
    );
};

export default CloudView;
