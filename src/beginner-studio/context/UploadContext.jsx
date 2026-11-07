import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import {aiUploadProblem, usesAi} from '../domain/ai/aiFirmware';
import {MICROPYTHON} from '../domain/boardLanguage';
import {cloudUploadProblem, hasCloud} from '../domain/cloud';
import {maskSecrets, readSecrets} from '../domain/cloudSecrets';
import {generateArduino} from '../domain/codegen';
import {comingSoonNote, micropythonBaud, micropythonCloudConfig, micropythonGaps} from '../domain/pycodegen';
import useBoardUpload from '../hooks/useBoardUpload.js';
import useCloudLive from '../hooks/useCloudLive.js';
import {BEGINNER_BAUD} from '../hooks/useSerialMonitor.js';

import {useStudio} from './StudioContext.jsx';

const UploadContext = createContext(null);

/** One board connection and upload state, shared by the top-bar button and the code panel. */
const UploadProvider = ({children}) => {
    const {connections, program, cloud, ai, generatedCode, view, boardTarget} = useStudio();
    const upload = useBoardUpload();
    const [cloudNote, setCloudNote] = useState('');
    const [aiNote, setAiNote] = useState('');
    const [boardNote, setBoardNote] = useState('');
    const uploadSecrets = useRef(null);
    const {uploadCode, uploadPython} = upload;
    const cloudOn = hasCloud(connections);
    const python = boardTarget === MICROPYTHON;
    const cloudLive = useCloudLive({
        cloud,
        uploadPhase: upload.phase,
        enabled: cloudOn && Boolean(cloud),
        watching: view === 'cloud',
        baud: python ? micropythonBaud(connections) : BEGINNER_BAUD,
        startOutput: python ? upload.startOutput : ''
    });
    const beginLive = cloudLive.begin;

    const handleUpload = useCallback(() => {
        setCloudNote('');
        setAiNote('');
        setBoardNote('');
        if (python) {
            // No Arduino fallback: flashing Arduino would wipe the board's MicroPython.
            const gaps = micropythonGaps(connections, program);
            if (gaps.length) {
                setBoardNote(comingSoonNote(gaps));
                return;
            }
            if (!hasCloud(connections)) {
                uploadSecrets.current = null;
                uploadPython(generatedCode, null);
                return;
            }
            const pySecrets = cloud ? readSecrets(cloud.email, cloud.deviceId) : null;
            const pyProblem = cloudUploadProblem(connections, cloud, pySecrets);
            if (pyProblem) {
                setCloudNote(pyProblem);
                return;
            }
            uploadSecrets.current = pySecrets;
            beginLive();
            uploadPython(generatedCode, micropythonCloudConfig(cloud, pySecrets));
            return;
        }
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
    }, [connections, program, cloud, ai, generatedCode, uploadCode, uploadPython, beginLive, python]);

    /** Puts the Edge AI recorder on the board in place of the program (the next Upload brings it back). */
    const uploadRecorder = useCallback(kind => {
        setCloudNote('');
        setAiNote('');
        setBoardNote('');
        if (python) {
            return;
        }
        uploadSecrets.current = null;
        uploadCode(generateArduino(connections, [], {aiRecorder: kind}));
    }, [connections, uploadCode, python]);

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
        boardNote,
        setBoardNote,
        handleUpload,
        uploadRecorder,
        cloudLive,
        hasCode: Boolean(generatedCode)
    }), [upload, message, log, cloudNote, aiNote, boardNote, handleUpload, uploadRecorder, cloudLive,
        generatedCode]);

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
