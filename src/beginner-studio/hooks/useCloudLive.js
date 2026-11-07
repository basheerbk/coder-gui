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
const WATCH_POLL_MS = 4000;
const SLOW_POLL_MS = 30000;
const GIVE_UP_MS = 75000;
const ARDUINO_BAUD = 9600;

const progressReducer = (state, action) => (action.type === 'reset' ? initialProgress() : reduceProgress(state, action));

/** Read what the freshly flashed board prints (the board resets right after flashing). */
const listenToBoard = (onLine, baud) => {
    let stopped = false;
    let remove = null;
    import('../../lib/web-serial/serial-monitor').then(async mon => {
        if (stopped) {
            return;
        }
        remove = mon.addSerialDataListener((decoder => bytes => onLine(decoder.decode(bytes, {stream: true})))(new TextDecoder()));
        if (!mon.isSerialMonitoring()) {
            try {
                await mon.startSerialMonitor(baud);
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
 * Follows a Cloud board from "upload started" to "live", and keeps its status, readings and
 * controls fresh for the Cloud tab and the top bar.
 * stage: idle | uploading | waiting | live | upload_failed
 * @param {object} options.cloud the project's Cloud link (deviceId), or null
 * @param {string} options.uploadPhase phase from useBoardUpload
 * @param {boolean} options.enabled the project has the Cloud part and a linked board
 * @param {boolean} options.watching the Cloud tab is open, so readings should update quickly
 * @param {number} [options.baud] serial speed of the board's prints: 9600 for Arduino, 115200
 *   for MicroPython
 * @param {string} [options.startOutput] what the program printed while the upload still held the
 *   port (MicroPython starts it before the upload ends)
 * @returns {object} live session state and controls
 */
const useCloudLive = ({cloud, uploadPhase, enabled, watching, baud = ARDUINO_BAUD, startOutput = ''}) => {
    const deviceId = enabled && cloud ? cloud.deviceId : null;
    const baudRef = useRef(baud);
    baudRef.current = baud;
    const startRef = useRef(startOutput);
    startRef.current = startOutput;
    const [stage, setStage] = useState('idle');
    const [detail, setDetail] = useState(null);
    const [pollTick, setPollTick] = useState(0);
    const refresh = useCallback(() => setPollTick(t => t + 1), []);
    const device = detail ? detail.device : null;
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
                setDetail(res);
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
        setDetail(prev => (prev && prev.device.id === deviceId ? prev : null));
    }, [deviceId, dismiss]);

    /** Show a control change straight away instead of waiting for the next poll. */
    const applyControl = useCallback(control => {
        setDetail(prev => {
            if (!prev || !control) {
                return prev;
            }
            const controls = prev.controls || [];
            const current = controls.find(c => c.key === control.key);
            if (current && current.version > control.version) {
                return prev;
            }
            return Object.assign({}, prev, {
                controls: current ?
                    controls.map(c => (c.key === control.key ? control : c)) :
                    controls.concat([control])
            });
        });
    }, []);

    useEffect(() => {
        if (stage !== 'waiting') {
            return undefined;
        }
        const onChunk = createLineSplitter(line => {
            const event = parseCloudLine(line);
            if (event) {
                dispatch(event);
            }
        });
        if (startRef.current) {
            onChunk(`${startRef.current}\n`);
        }
        const stopListening = listenToBoard(onChunk, baudRef.current);
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
        let wait = SLOW_POLL_MS;
        if (fast) {
            wait = FAST_POLL_MS;
        } else if (watching) {
            wait = WATCH_POLL_MS;
        }
        let cancelled = false;
        let timer = null;
        const poll = async () => {
            if (!fast && document.visibilityState === 'hidden') {
                timer = setTimeout(poll, wait);
                return;
            }
            try {
                const res = await iotApi.getDevice(deviceId);
                if (cancelled) {
                    return;
                }
                setDetail(res);
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
                timer = setTimeout(poll, wait);
            }
        };
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [deviceId, stage, watching, pollTick]);

    return useMemo(
        () => ({stage, progress, device, detail, begin, dismiss, applyControl, refresh}),
        [stage, progress, device, detail, begin, dismiss, applyControl, refresh]
    );
};

export default useCloudLive;
