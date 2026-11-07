import {useCallback, useState} from 'react';

import {isWebSerialSupported} from '../../lib/web-serial/supported-browsers';

/** Maker ESP32 — same FQBN / esptool path as Advanced IDE. */
const BEGINNER_DEVICE_ID = 'arduinoEsp32';

const plainError = text => (/^Timed out waiting/.test(text) ?
    'The board stopped answering. Check the USB cable, then try again.' :
    text);

/**
 * Lazy-loads heavy Web Serial / esptool code only when the user connects or uploads,
 * so Beginner Studio can boot without those libraries.
 */
const useBoardUpload = () => {
    const [phase, setPhase] = useState('idle'); // idle | connecting | uploading | success | error
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState(null);
    const [log, setLog] = useState('');
    const [connected, setConnected] = useState(false);
    const [portLabel, setPortLabel] = useState('');
    const [boardInfo, setBoardInfo] = useState(null);
    // What a MicroPython program printed while the upload still held the port.
    const [startOutput, setStartOutput] = useState('');
    // Update board: idle | checking | installing | done | error
    const [update, setUpdate] = useState({phase: 'idle', message: '', progress: null});

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
            // Release any Beginner serial-monitor locks before opening the port.
            try {
                const mon = await import('../../lib/web-serial/serial-monitor');
                if (mon.isSerialMonitoring()) {
                    await mon.stopSerialMonitor();
                }
            } catch (e) {
                // ignore
            }
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
        setMessage('Compiling…');
        setProgress(null);
        setLog('');
        setStartOutput('');

        try {
            const {uploadSketchWebSerial} = await import('../../lib/web-serial/upload-pipeline');
            await uploadSketchWebSerial(
                BEGINNER_DEVICE_ID,
                source,
                (text, pct) => {
                    setMessage(text);
                    if (pct != null) {
                        setProgress(pct);
                    }
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

    // Put a MicroPython program on the board: no compile, only files over the REPL. The board
    // info comes first; a board without MicroPython stops with a pointer to Update board.
    // config is the Cloud settings file (WiFi, device key) for a Cloud project, else null.
    const uploadPython = useCallback(async (source, config) => {
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
        setMessage('Checking your board…');
        setProgress(null);
        setLog('');
        setStartOutput('');
        const onProgress = (text, pct) => {
            setMessage(text);
            if (typeof pct === 'number') {
                setProgress(pct);
            }
        };
        const onLog = chunk => setLog(prev => `${prev}${chunk}`);

        uploadState.beginUpload();
        const mon = await import('../../lib/web-serial/serial-monitor');
        try {
            const [{uploadMicroPython}, {default: library}] = await Promise.all([
                import('../micropython/upload'),
                import('../micropython/libraryFiles')
            ]);
            await mon.notifyFlashStarting();
            await portMod.openExistingPort(115200);
            const result = await uploadMicroPython({
                port: portMod.getPort(),
                source,
                library,
                config: config || null,
                onProgress,
                onLog,
                isAborted: uploadState.isAbortRequested
            });
            setBoardInfo(result.info || null);
            setStartOutput(result.output || '');
            if (result.programError) {
                setPhase('error');
                setMessage(`Your program stopped: ${result.programError}`);
            } else {
                setPhase('success');
                setMessage('Upload complete');
            }
        } catch (err) {
            setPhase('error');
            setMessage(plainError((err && err.message) || 'Upload failed'));
            if (err && err.info) {
                setBoardInfo(err.info);
            }
            if (err && err.traceback) {
                setLog(prev => `${prev}${err.traceback}\n`);
            }
        } finally {
            uploadState.endUpload();
            mon.notifyFlashComplete();
            await refreshConnection();
        }
    }, [connectBoard, refreshConnection]);

    // Update board keeps its own status, so the Upload button does not show Done for it.
    const runOnBoard = useCallback(async (step, task) => {
        if (!isWebSerialSupported()) {
            setUpdate({phase: 'error', message: 'Use Chrome or Edge on a computer for Upload.', progress: null});
            return null;
        }
        const uploadState = await import('../../lib/web-serial/upload-state');
        if (uploadState.isUploadInProgress()) {
            return null;
        }
        const portMod = await import('../../lib/web-serial/web-serial-port');
        if (!portMod.isConnected()) {
            const ok = await connectBoard();
            if (!ok) {
                return null;
            }
        }
        setUpdate({phase: step, message: '', progress: null});
        uploadState.beginUpload();
        const mon = await import('../../lib/web-serial/serial-monitor');
        try {
            await mon.notifyFlashStarting();
            await portMod.openExistingPort(115200);
            return await task(portMod, uploadState);
        } catch (err) {
            setUpdate({phase: 'error', message: plainError((err && err.message) || 'Update failed'), progress: null});
            return null;
        } finally {
            uploadState.endUpload();
            mon.notifyFlashComplete();
            await refreshConnection();
        }
    }, [connectBoard, refreshConnection]);

    const appendLog = useCallback(chunk => setLog(prev => `${prev}${chunk}`), []);

    // What the board runs now, for the Update board dialog.
    const checkBoard = useCallback(() => runOnBoard('checking', async portMod => {
        const {checkBoard: readBoard} = await import('../micropython/upload');
        const info = await readBoard({port: portMod.getPort(), onLog: appendLog});
        setBoardInfo(info);
        setUpdate({phase: 'idle', message: '', progress: null});
        return info;
    }), [runOnBoard, appendLog]);

    // Flash the bundled TinkerBit firmware, then its boot.py. Erases the board's program and Cloud settings.
    const updateBoard = useCallback(() => runOnBoard('installing', async (portMod, uploadState) => {
        const step = (text, pct) => setUpdate(prev => ({
            phase: 'installing',
            message: text,
            progress: typeof pct === 'number' ? pct : prev.progress
        }));
        const [{installLibrary}, firmware, {default: library}] = await Promise.all([
            import('../micropython/upload'),
            import('../micropython/installFirmware'),
            import('../micropython/libraryFiles')
        ]);
        setLog('');
        step('MicroPython: getting the firmware…', 0);
        await firmware.installFirmware(
            portMod.getPort(),
            (text, pct) => step(`MicroPython: ${text}`, typeof pct === 'number' ? Math.round(pct * 0.9) : pct),
            appendLog
        );
        await portMod.reopenPort(115200);
        const info = await installLibrary({
            port: portMod.getPort(),
            library,
            onProgress: (text, pct) => step(text, 90 + Math.round(pct / 10)),
            onLog: appendLog,
            isAborted: uploadState.isAbortRequested
        });
        setBoardInfo(info);
        setUpdate({phase: 'done', message: '', progress: 100});
        return info;
    }), [runOnBoard, appendLog]);

    const clearUpdate = useCallback(() => setUpdate({phase: 'idle', message: '', progress: null}), []);

    const cancelUpload = useCallback(() => {
        import('../../lib/web-serial/upload-state').then(mod => {
            mod.requestAbort();
            setMessage('Cancelling…');
        }).catch(() => {});
    }, []);

    return {
        phase,
        message,
        progress,
        log,
        connected,
        portLabel,
        supported: isWebSerialSupported(),
        busy: phase === 'uploading' || phase === 'connecting' ||
            update.phase === 'checking' || update.phase === 'installing',
        boardInfo,
        startOutput,
        update,
        checkBoard,
        updateBoard,
        clearUpdate,
        connectBoard,
        uploadCode,
        uploadPython,
        cancelUpload,
        refreshConnection
    };
};

export default useBoardUpload;
export {BEGINNER_DEVICE_ID};
