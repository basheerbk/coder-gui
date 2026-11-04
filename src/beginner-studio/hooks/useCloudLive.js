import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';

import {
    cameOnline,
    createLineSplitter,
    initialProgress,
    parseCloudLine,
    reduceProgress
} from '../domain/cloudProgress';
import {iotApi} from '../../lib/iot-api';

const FAST_POLL_MS = 3000;
const SLOW_POLL_MS = 30000;
const GIVE_UP_MS = 75000;
const SERIAL_BAUD = 9600;

const progressReducer = (state, action) => (action.type === 'reset' ? initialProgress() : reduceProgress(state, action));

/** Read what the freshly flashed board prints (the board resets right after flashing). */
const listenToBoard = onLine => {
    let stopped = false;
    let remove = null;
    import('../../lib/web-serial/serial-monitor').then(async mon => {
        if (stopped) {
            return;
        }
        remove = mon.addSerialDataListener((decoder => bytes => onLine(decoder.decode(bytes, {stream: true})))(new TextDecoder()));
        if (!mon.isSerialMonitoring()) {
            try {
                await mon.startSerialMonitor(SERIAL_BAUD);
            } catch (err) {
                // Board unplugged or port busy: the Cloud service check still works.
            }
        }
    }).catch(() => {});
    return () => {
        stopped = true;
        if (remove) {
            remove();
        }
    };
};

/**
 * Follows a Cloud board from "upload started" to "live", and keeps its online status fresh for
 * the top-bar Cloud button.
 * stage: idle | uploading | waiting | live | upload_failed
 * @param {object} options.cloud the project's Cloud link (deviceId), or null
 * @param {string} options.uploadPhase phase from useBoardUpload
 * @param {boolean} options.enabled the project has the Cloud part and a linked board
 * @returns {object} live session state and controls
 */
const useCloudLive = ({cloud, uploadPhase, enabled}) => {
    const deviceId = enabled && cloud ? cloud.deviceId : null;
    const [stage, setStage] = useState('idle');
    const [device, setDevice] = useState(null);
    const [progress, dispatch] = useReducer(progressReducer, undefined, initialProgress);
    const before = useRef(undefined);
    const sessionDevice = useRef(null);

    const begin = useCallback(() => {
        if (!deviceId) {
            return;
        }
        sessionDevice.current = deviceId;
        before.current = undefined;
        dispatch({type: 'reset'});
        setStage('uploading');
        iotApi.getDevice(deviceId).then(res => {
            if (sessionDevice.current === deviceId) {
                before.current = res.device;
                setDevice(res.device);
            }
        }).catch(() => {});
    }, [deviceId]);

    const dismiss = useCallback(() => {
        sessionDevice.current = null;
        setStage('idle');
        dispatch({type: 'reset'});
    }, []);

    useEffect(() => {
        if (stage !== 'uploading') {
            return;
        }
        if (uploadPhase === 'success') {
            setStage('waiting');
        } else if (uploadPhase === 'error') {
            setStage('upload_failed');
        }
    }, [stage, uploadPhase]);

    // A different board or no Cloud any more ends the session.
    useEffect(() => {
        if (sessionDevice.current && sessionDevice.current !== deviceId) {
            dismiss();
        }
        if (!deviceId) {
            setDevice(null);
        }
    }, [deviceId, dismiss]);

    useEffect(() => {
        if (stage !== 'waiting') {
            return undefined;
        }
        const stopListening = listenToBoard(createLineSplitter(line => {
            const event = parseCloudLine(line);
            if (event) {
                dispatch(event);
            }
        }));
        const giveUp = setTimeout(() => dispatch({type: 'timeout'}), GIVE_UP_MS);
        return () => {
            stopListening();
            clearTimeout(giveUp);
        };
    }, [stage]);

    useEffect(() => {
        if (!deviceId || stage === 'uploading') {
            return undefined;
        }
        const fast = stage === 'waiting';
        let cancelled = false;
        let timer = null;
        const poll = async () => {
            if (!fast && document.visibilityState === 'hidden') {
                timer = setTimeout(poll, SLOW_POLL_MS);
                return;
            }
            try {
                const res = await iotApi.getDevice(deviceId);
                if (cancelled) {
                    return;
                }
                setDevice(res.device);
                if (fast) {
                    // No baseline (the first fetch failed): a board cannot rejoin WiFi and Cloud
                    // within one poll of flashing, so the first answer is the "before" state.
                    if (before.current === undefined) {
                        before.current = res.device;
                    } else if (cameOnline(res.device, before.current)) {
                        dispatch({type: 'server_online'});
                        setStage('live');
                        return;
                    }
                }
            } catch (err) {
                // Offline or Cloud busy: keep trying quietly.
            }
            if (!cancelled) {
                timer = setTimeout(poll, fast ? FAST_POLL_MS : SLOW_POLL_MS);
            }
        };
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [deviceId, stage]);

    return useMemo(() => ({stage, progress, device, begin, dismiss}), [stage, progress, device, begin, dismiss]);
};

export default useCloudLive;
