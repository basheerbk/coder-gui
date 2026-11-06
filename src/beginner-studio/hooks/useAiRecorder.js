import {useCallback, useEffect, useRef, useState} from 'react';

import {AI_LIMITS} from '../domain/ai/aiKinds';
import {parseAiLine} from '../domain/ai/aiLine';
import {createLineSplitter} from '../domain/cloudProgress';

const BAUD = 9600;
// The recorder says hello every 2 s; after this long without one, it is not running.
const HELLO_GONE_MS = 5000;
const RESTART_MS = 600;

const loadMonitor = () => import('../../lib/web-serial/serial-monitor');
const loadUploadState = () => import('../../lib/web-serial/upload-state');

/**
 * Reads the Edge AI recorder over USB while the Edge AI page is open.
 * board: off (not connected) | waiting (nothing heard yet) | silent (the board runs something
 *   else) | other (a recorder for other parts) | no_sensor | ready
 * @param {boolean} options.active the page is open and the board is connected
 * @param {string} options.kind motion | sensors
 * @param {string} options.sig signature of the parts on the board now
 * @param {number} options.count features per example for these parts
 * @param {Function} options.onTake (thingId, examples) when a recording ends with examples
 * @param {Function} options.setBusy tells the studio a recording is running (pauses undo)
 * @returns {object} board state, live readings and recording controls
 */
const useAiRecorder = ({active, kind, sig, count, onTake, setBusy}) => {
    const [board, setBoard] = useState('waiting');
    const [level, setLevel] = useState(0);
    const [latest, setLatest] = useState(null);
    const [recording, setRecording] = useState(null);
    const expect = useRef({kind, sig, count});
    expect.current = {kind, sig, count};
    const rec = useRef(null);
    const heard = useRef({hello: 0, any: 0, hello_ok: false});
    const callbacks = useRef({onTake, setBusy});
    callbacks.current = {onTake, setBusy};
    const mounted = useRef(true);

    const finish = useCallback(() => {
        const r = rec.current;
        rec.current = null;
        if (mounted.current) {
            setRecording(null);
        }
        callbacks.current.setBusy(false);
        if (r && r.examples.length) {
            callbacks.current.onTake(r.thing, r.examples);
        }
    }, []);

    const onLine = useCallback(line => {
        const event = parseAiLine(line);
        const now = Date.now();
        heard.current.any = now;
        if (!event) {
            return;
        }
        const want = expect.current;
        if (event.type === 'hello') {
            heard.current.hello = now;
            heard.current.hello_ok = event.kind === want.kind && event.sig === want.sig && event.n === want.count;
            setBoard(prev => {
                if (!heard.current.hello_ok) {
                    return 'other';
                }
                return prev === 'no_sensor' ? prev : 'ready';
            });
            return;
        }
        if (event.type === 'error') {
            setBoard(event.code === 'no_sensor' ? 'no_sensor' : 'other');
            return;
        }
        if (!heard.current.hello_ok) {
            return;
        }
        if (event.type === 'level') {
            setBoard('ready');
            setLevel(event.value);
            return;
        }
        if (event.type === 'example' && event.f.length === want.count) {
            setBoard('ready');
            setLatest({f: event.f, at: now});
            const r = rec.current;
            if (r) {
                r.examples.push(event.f);
                setRecording({thing: r.thing, got: r.examples.length, target: r.target});
                if (r.examples.length >= r.target) {
                    finish();
                }
            }
        }
    }, [finish]);

    // Listen while active; the serial monitor stops for uploads and other screens, so start it again.
    useEffect(() => {
        if (!active) {
            setBoard('off');
            return undefined;
        }
        setBoard('waiting');
        heard.current = {hello: 0, any: 0, hello_ok: false};
        let stopped = false;
        let removeListener = null;
        let onStop = null;
        let timer = null;
        const start = async () => {
            try {
                const [mon, uploadState] = await Promise.all([loadMonitor(), loadUploadState()]);
                if (stopped || uploadState.isUploadInProgress() || mon.isSerialMonitoring()) {
                    return;
                }
                await mon.startSerialMonitor(BAUD);
            } catch (err) {
                // Port busy or unplugged: the page shows "waiting" and offers to connect again.
            }
        };
        loadMonitor().then(mon => {
            if (stopped) {
                return;
            }
            const decoder = new TextDecoder();
            const split = createLineSplitter(onLine);
            removeListener = mon.addSerialDataListener(bytes => split(decoder.decode(bytes, {stream: true})));
            onStop = () => {
                clearTimeout(timer);
                timer = setTimeout(start, RESTART_MS);
            };
            mon.webSerialMonitorEvents.addEventListener(mon.MONITOR_STOP, onStop);
            start();
        }).catch(() => {});
        const tick = setInterval(() => {
            const now = Date.now();
            if (heard.current.hello && now - heard.current.hello > HELLO_GONE_MS) {
                heard.current.hello_ok = false;
                setBoard('silent');
            } else if (!heard.current.hello && heard.current.any && now - heard.current.any < HELLO_GONE_MS) {
                setBoard(prev => (prev === 'waiting' ? 'silent' : prev));
            }
        }, 1000);
        return () => {
            stopped = true;
            clearTimeout(timer);
            clearInterval(tick);
            if (removeListener) {
                removeListener();
            }
            loadMonitor().then(mon => {
                if (onStop) {
                    mon.webSerialMonitorEvents.removeEventListener(mon.MONITOR_STOP, onStop);
                }
            }).catch(() => {});
        };
    }, [active, onLine]);

    // A changed part list means the recorder on the board no longer matches.
    useEffect(() => {
        heard.current.hello_ok = false;
        setBoard(prev => (prev === 'ready' ? 'waiting' : prev));
    }, [kind, sig, count]);

    // Leaving the page, or the board going away, ends a recording and keeps what it got.
    useEffect(() => {
        if (board !== 'ready' && rec.current) {
            finish();
        }
    }, [board, finish]);
    useEffect(() => () => {
        mounted.current = false;
        if (rec.current) {
            finish();
        }
    }, [finish]);

    /** Records up to `room` examples of a thing (10 at a time), then stops by itself. */
    const record = useCallback((thingId, room) => {
        if (rec.current || board !== 'ready' || room <= 0) {
            return;
        }
        const target = Math.min(AI_LIMITS.takeSize, room);
        rec.current = {thing: thingId, examples: [], target};
        setRecording({thing: thingId, got: 0, target});
        callbacks.current.setBusy(true);
    }, [board]);

    return {board, level, latest, recording, record, stop: finish};
};

export default useAiRecorder;
