import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {hasCloud} from '../../domain/cloud';
import {moduleById} from '../../domain/modules';

import AccountMenu from './AccountMenu.jsx';
import UndoButtons from './UndoButtons.jsx';
import UploadButton from './UploadButton.jsx';

/** What the Cloud button says: set up, connecting after an upload, needs help, live or offline. */
const cloudLook = (K, cloudPart, cloud, live) => {
    if (!cloudPart) {
        return {text: 'Cloud', dot: K.dim, title: 'Send readings to your phone with TinkerBit Cloud'};
    }
    if (!cloud) {
        return {text: 'Cloud · set up', dot: K.orange, title: 'Finish setting up Cloud', border: K.orange};
    }
    const name = cloud.deviceName;
    if (live.stage === 'waiting') {
        return live.progress.problem && live.progress.problem !== 'timeout' ?
            {text: 'Cloud · needs help', dot: K.red, title: `${name} cannot go online. Click to see why.`, border: K.red} :
            {text: 'Cloud · connecting…', dot: K.orange, blink: true, title: `${name} is going online`};
    }
    const status = live.device && live.device.id === cloud.deviceId ? live.device.status : null;
    if (status === 'online') {
        return {text: `Cloud · ${name}`, dot: K.green, title: `${name} is online`};
    }
    if (status === 'disabled') {
        return {text: `Cloud · ${name}`, dot: K.red, title: `${name} was turned off`, border: K.red};
    }
    return {text: `Cloud · ${name}`, dot: K.dim, title: status ? `${name} is offline` : `Cloud: ${name}`};
};

const TopBar = () => {
    const {
        view,
        setView,
        projectName,
        setProjectName,
        selectedModule,
        connections,
        setShowProjectLibrary,
        clearSelection,
        K,
        cloud,
        setShowCloudSetup
    } = useStudio();
    const cloudPart = hasCloud(connections);
    const {cloudLive} = useUpload();
    const look = cloudLook(K, cloudPart, cloud, cloudLive);
    const liveSession = cloudLive.stage === 'waiting' || cloudLive.stage === 'live';

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;

    const tabStyle = active => ({
        border: 'none',
        background: active ? K.accent : 'transparent',
        color: active ? '#fff' : K.sub,
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
    });

    return (
        <header
            style={{
                height: 48,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 12px',
                background: K.panel,
                borderBottom: `1px solid ${K.border}`
            }}
        >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <div
                    aria-hidden="true"
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: `linear-gradient(135deg, ${K.accent}, ${K.cyan})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#fff'
                    }}
                >
                    TB
                </div>
                <span style={{fontWeight: 700, fontSize: 14, color: K.text}}>TinkerBit</span>
            </div>

            <button
                type="button"
                onClick={() => setShowProjectLibrary(true)}
                style={{
                    background: K.surface,
                    border: 'none',
                    color: K.text,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer'
                }}
            >
                Projects
            </button>

            <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                aria-label="Project name"
                style={{
                    width: 160,
                    background: K.canvas,
                    border: `1px solid ${K.border}`,
                    borderRadius: 8,
                    color: K.text,
                    padding: '6px 10px',
                    fontSize: 12
                }}
            />

            <div
                style={{
                    display: 'flex',
                    background: K.canvas,
                    borderRadius: 10,
                    padding: 3,
                    gap: 2
                }}
            >
                <button type="button" style={tabStyle(view === 'build')} onClick={() => setView('build')}>
                    Build
                </button>
                <button type="button" style={tabStyle(view === 'code')} onClick={() => setView('code')}>
                    Code
                </button>
            </div>

            <UndoButtons />

            <div style={{flex: 1}} />

            {selectedModule && selectedDef ? (
                <div
                    role="status"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: `${K.accent}22`,
                        border: `1px solid ${K.accent}`,
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: K.text
                    }}
                >
                    {`Click a glowing port to plug in the ${selectedDef.name}`}
                    <button
                        type="button"
                        onClick={clearSelection}
                        style={{
                            border: 'none',
                            background: K.surface,
                            color: K.text,
                            borderRadius: 999,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: 11
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => setShowCloudSetup(cloudPart && cloud && liveSession ? 'live' : true)}
                title={look.title}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 200,
                    background: K.surface,
                    border: `1px solid ${look.border || K.border}`,
                    color: K.text,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer'
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        flexShrink: 0,
                        background: look.dot,
                        animation: look.blink ? 'tbDotBlink 1.2s ease-in-out infinite' : 'none'
                    }}
                />
                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {look.text}
                </span>
            </button>

            <UploadButton />

            <AccountMenu />
        </header>
    );
};

export default TopBar;
