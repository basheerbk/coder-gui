import {useCallback, useState} from 'react';

import {isWebSerialSupported} from '../../lib/web-serial/supported-browsers';

/** Maker ESP32 — same FQBN / esptool path as Advanced IDE. */
const BEGINNER_DEVICE_ID = 'arduinoEsp32';

/**
 * Lazy-loads heavy Web Serial / esptool code only when the user connects or uploads,
 * so Beginner Studio can boot without those libraries.
 */
const useBoardUpload = () => {
    const [phase, setPhase] = useState('idle'); // idle | connecting | uploading | success | error
    const [message, setMessage] = useState('');
    const [log, setLog] = useState('');
    const [connected, setConnected] = useState(false);
    const [portLabel, setPortLabel] = useState('');

    const refreshConnection = useCallback(async () => {
        try {
            const portMod = await import('../../lib/web-serial/web-serial-port');
            const ok = portMod.isConnected();
            setConnected(ok);
            setPortLabel(ok ? (portMod.getPortLabel() || 'Board') : '');
            return ok;
        } catch (err) {
            setConnected(false);
            setPortLabel('');
            return false;
        }
    }, []);

    const connectBoard = useCallback(async () => {
        if (!isWebSerialSupported()) {
            setPhase('error');
            setMessage('Use Chrome or Edge on a computer for Upload.');
            return false;
        }
        setPhase('connecting');
        setMessage('Pick your Maker ESP32…');
        setLog('');
        try {
            const portMod = await import('../../lib/web-serial/web-serial-port');
            await portMod.requestAndOpenPort(115200);
            await refreshConnection();
            setPhase('idle');
            setMessage('Board connected');
            return true;
        } catch (err) {
            setPhase('error');
            setMessage((err && err.message) || 'Could not connect');
            await refreshConnection();
            return false;
        }
    }, [refreshConnection]);

    const uploadCode = useCallback(async source => {
        if (!source || !String(source).trim()) {
            setPhase('error');
            setMessage('No code to upload yet.');
            return;
        }
        if (!isWebSerialSupported()) {
            setPhase('error');
            setMessage('Use Chrome or Edge on a computer for Upload.');
            return;
        }

        const uploadState = await import('../../lib/web-serial/upload-state');
        if (uploadState.isUploadInProgress()) {
            return;
        }

        const portMod = await import('../../lib/web-serial/web-serial-port');
        if (!portMod.isConnected()) {
            const ok = await connectBoard();
            if (!ok) {
                return;
            }
        }

        setPhase('uploading');
        setMessage('Compiling on server…');
        setLog('');

        try {
            const {uploadSketchWebSerial} = await import('../../lib/web-serial/upload-pipeline');
            await uploadSketchWebSerial(
                BEGINNER_DEVICE_ID,
                source,
                (text, pct) => {
                    const suffix = pct != null ? ` (${pct}%)` : '';
                    setMessage(`${text}${suffix}`);
                },
                chunk => {
                    setLog(prev => `${prev}${chunk}`);
                }
            );
            setPhase('success');
            setMessage('Upload complete');
            await refreshConnection();
        } catch (err) {
            setPhase('error');
            setMessage((err && err.message) || 'Upload failed');
            if (err && err.log) {
                setLog(prev => `${prev}${err.log}\n`);
            }
            await refreshConnection();
        }
    }, [connectBoard, refreshConnection]);

    const cancelUpload = useCallback(() => {
        import('../../lib/web-serial/upload-state').then(mod => {
            mod.requestAbort();
            setMessage('Cancelling…');
        }).catch(() => {});
    }, []);

    return {
        phase,
        message,
        log,
        connected,
        portLabel,
        supported: isWebSerialSupported(),
        busy: phase === 'uploading' || phase === 'connecting',
        connectBoard,
        uploadCode,
        cancelUpload,
        refreshConnection
    };
};

export default useBoardUpload;
export {BEGINNER_DEVICE_ID};
