import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import {aiUploadProblem, usesAi} from '../domain/ai/aiFirmware';
import {cloudUploadProblem, hasCloud} from '../domain/cloud';
import {maskSecrets, readSecrets} from '../domain/cloudSecrets';
import {generateArduino} from '../domain/codegen';
import useBoardUpload from '../hooks/useBoardUpload.js';
import useCloudLive from '../hooks/useCloudLive.js';

import {useStudio} from './StudioContext.jsx';

const UploadContext = createContext(null);

/** One board connection and upload state, shared by the top-bar button and the code panel. */
const UploadProvider = ({children}) => {
    const {connections, program, cloud, ai, generatedCode, view} = useStudio();
    const upload = useBoardUpload();
    const [cloudNote, setCloudNote] = useState('');
    const [aiNote, setAiNote] = useState('');
    const uploadSecrets = useRef(null);
    const {uploadCode} = upload;
    const cloudOn = hasCloud(connections);
    const cloudLive = useCloudLive({
        cloud,
        uploadPhase: upload.phase,
        enabled: cloudOn && Boolean(cloud),
        watching: view === 'cloud'
    });
    const beginLive = cloudLive.begin;

    const handleUpload = useCallback(() => {
        setCloudNote('');
        setAiNote('');
        const aiProblem = aiUploadProblem(connections, program, ai);
        if (aiProblem) {
            setAiNote(aiProblem);
            return;
        }
        const withAi = usesAi(program);
        if (!hasCloud(connections)) {
            uploadSecrets.current = null;
            uploadCode(withAi ? generateArduino(connections, program, {ai, aiModel: true}) : generatedCode);
            return;
        }
        const secrets = cloud ? readSecrets(cloud.email, cloud.deviceId) : null;
        const problem = cloudUploadProblem(connections, cloud, secrets);
        if (problem) {
            setCloudNote(problem);
            return;
        }
        uploadSecrets.current = secrets;
        beginLive();
        uploadCode(generateArduino(connections, program, {cloud, secrets, ai, aiModel: true}));
    }, [connections, program, cloud, ai, generatedCode, uploadCode, beginLive]);

    /** Puts the Edge AI recorder on the board in place of the program (the next Upload brings it back). */
    const uploadRecorder = useCallback(kind => {
        setCloudNote('');
        setAiNote('');
        uploadSecrets.current = null;
        uploadCode(generateArduino(connections, [], {aiRecorder: kind}));
    }, [connections, uploadCode]);

    // The WiFi password and device key must never reach the screen, even inside raw tool output.
    const message = maskSecrets(upload.message, uploadSecrets.current);
    const log = maskSecrets(upload.log, uploadSecrets.current);

    const value = useMemo(() => Object.assign({}, upload, {
        message,
        log,
        cloudNote,
        setCloudNote,
        aiNote,
        setAiNote,
        handleUpload,
        uploadRecorder,
        cloudLive,
        hasCode: Boolean(generatedCode)
    }), [upload, message, log, cloudNote, aiNote, handleUpload, uploadRecorder, cloudLive, generatedCode]);

    return (
        <UploadContext.Provider value={value}>
            {children}
        </UploadContext.Provider>
    );
};

const useUpload = () => {
    const ctx = useContext(UploadContext);
    if (!ctx) {
        throw new Error('useUpload must be used within UploadProvider');
    }
    return ctx;
};

export {UploadProvider, useUpload};
