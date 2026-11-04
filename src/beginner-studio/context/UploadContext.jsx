import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import {cloudUploadProblem, hasCloud} from '../domain/cloud';
import {maskSecrets, readSecrets} from '../domain/cloudSecrets';
import {generateArduino} from '../domain/codegen';
import useBoardUpload from '../hooks/useBoardUpload.js';

import {useStudio} from './StudioContext.jsx';

const UploadContext = createContext(null);

/** One board connection and upload state, shared by the top-bar button and the code panel. */
const UploadProvider = ({children}) => {
    const {connections, program, cloud, generatedCode} = useStudio();
    const upload = useBoardUpload();
    const [cloudNote, setCloudNote] = useState('');
    const uploadSecrets = useRef(null);
    const {uploadCode} = upload;

    const handleUpload = useCallback(() => {
        setCloudNote('');
        if (!hasCloud(connections)) {
            uploadSecrets.current = null;
            uploadCode(generatedCode);
            return;
        }
        const secrets = cloud ? readSecrets(cloud.email, cloud.deviceId) : null;
        const problem = cloudUploadProblem(connections, cloud, secrets);
        if (problem) {
            setCloudNote(problem);
            return;
        }
        uploadSecrets.current = secrets;
        uploadCode(generateArduino(connections, program, {cloud, secrets}));
    }, [connections, program, cloud, generatedCode, uploadCode]);

    // The WiFi password and device key must never reach the screen, even inside raw tool output.
    const message = maskSecrets(upload.message, uploadSecrets.current);
    const log = maskSecrets(upload.log, uploadSecrets.current);

    const value = useMemo(() => Object.assign({}, upload, {
        message,
        log,
        cloudNote,
        setCloudNote,
        handleUpload,
        hasCode: Boolean(generatedCode)
    }), [upload, message, log, cloudNote, handleUpload, generatedCode]);

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
