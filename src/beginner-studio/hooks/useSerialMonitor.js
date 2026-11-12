import {useCallback, useEffect, useRef, useState} from 'react';

import {isWebSerialSupported} from '../../lib/web-serial/supported-browsers';

const BEGINNER_BAUD = 9600; // matches Serial.begin(9600) in codegen

// EN held low this long restarts the ESP32.
const RESET_HOLD_MS = 100;
// The ROM prints its boot log at 115200 right after reset; at 9600 it is garbage, and it
// means nothing to a student either way. The program's first line comes about 1 s later.
const BOOT_LOG_MS = 400;
// Silence this long after Start suggests the board is not running the program.
const QUIET_HINT_MS = 4000;
const QUIET_HINT = 'No messages from the board yet. If your program prints, press RST on the board once: ' +
    'some laptops start the board in its flashing mode when it is plugged in.';

const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * Restart the board into its program. The auto-reset circuit drives GPIO 0 from DTR and EN
 * from RTS (both inverted): DTR low keeps GPIO 0 high, so the board boots normally even if
 * it was sitting in its flashing mode after being plugged in.
 * @param {SerialPort} port open port
 * @returns {Promise<boolean>} false when the driver refused the signals
 */
const restartBoard = async port => {
    try {
        await port.setSignals({dataTerminalReady: false, requestToSend: true});
    } catch (e) {
        return false;
    }
    try {
        await delay(RESET_HOLD_MS);
    } finally {
        try {
            await port.setSignals({requestToSend: false});
        } catch (e) {
            // Port closed meanwhile: closing releases RTS too.
        }
    }
    return true;
};

/**
 * Beginner Studio serial monitor — reuses Advanced IDE Web Serial monitor helpers.
 * Start restarts the board, so the student sees the program from its first line.
 * @param {object} [options] {connected, baudRate}
 * @returns {object} monitor state and actions
 */
const useSerialMonitor = ({connected, baudRate = BEGINNER_BAUD} = {}) => {
    const [lines, setLines] = useState('');
    const [monitoring, setMonitoring] = useState(false);
    const [error, setError] = useState('');
    const [hint, setHint] = useState('');
    const bufferRef = useRef('');
    const bottomRef = useRef(null);
    const startingRef = useRef(false);
    const muteUntilRef = useRef(0);
    const quietTimerRef = useRef(null);

    const clearQuietTimer = useCallback(() => {
        if (quietTimerRef.current) {
            clearTimeout(quietTimerRef.current);
            quietTimerRef.current = null;
        }
    }, []);

    const appendText = useCallback(chunk => {
        bufferRef.current += chunk;
        // Cap memory — keep last ~12k chars
        if (bufferRef.current.length > 12000) {
            bufferRef.current = bufferRef.current.slice(-10000);
        }
        setLines(bufferRef.current);
    }, []);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let removeHandler = null;
        let flashStart = null;
        let flashDone = null;
        let monitorOn = null;
        let monitorOff = null;

        (async () => {
            try {
                const mon = await import('../../lib/web-serial/serial-monitor');
                if (cancelled) {
                    return;
                }
                const decoder = new TextDecoder();
                const onBytes = value => {
                    if (Date.now() < muteUntilRef.current) {
                        return;
                    }
                    clearQuietTimer();
                    setHint('');
                    appendText(decoder.decode(value, {stream: true}));
                };
                mon.setSerialDataHandler(onBytes);
                removeHandler = () => mon.setSerialDataHandler(null);

                flashStart = () => {
                    setMonitoring(false);
                };
                flashDone = () => {
                    // User restarts monitor after upload (baud back to 9600).
                };
                // The Cloud go-live checklist can start reading by itself after an upload.
                monitorOn = () => setMonitoring(true);
                monitorOff = () => setMonitoring(false);
                mon.webSerialMonitorEvents.addEventListener(mon.FLASH_START, flashStart);
                mon.webSerialMonitorEvents.addEventListener(mon.FLASH_COMPLETE, flashDone);
                mon.webSerialMonitorEvents.addEventListener(mon.MONITOR_START, monitorOn);
                mon.webSerialMonitorEvents.addEventListener(mon.MONITOR_STOP, monitorOff);
                setMonitoring(mon.isSerialMonitoring());
            } catch (err) {
                // ignore load errors until Start is clicked
            }
        })();

        return () => {
            cancelled = true;
            clearQuietTimer();
            if (removeHandler) {
                removeHandler();
            }
            import('../../lib/web-serial/serial-monitor').then(mon => {
                if (flashStart) {
                    mon.webSerialMonitorEvents.removeEventListener(mon.FLASH_START, flashStart);
                }
                if (flashDone) {
                    mon.webSerialMonitorEvents.removeEventListener(mon.FLASH_COMPLETE, flashDone);
                }
                if (monitorOn) {
                    mon.webSerialMonitorEvents.removeEventListener(mon.MONITOR_START, monitorOn);
                    mon.webSerialMonitorEvents.removeEventListener(mon.MONITOR_STOP, monitorOff);
                }
                if (mon.isSerialMonitoring()) {
                    mon.stopSerialMonitor();
                }
            }).catch(() => {});
        };
    }, [appendText, clearQuietTimer]);

    useEffect(() => {
        if (!monitoring) {
            clearQuietTimer();
            setHint('');
        }
    }, [monitoring, clearQuietTimer]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
        }
    }, [lines]);

    const start = useCallback(async () => {
        setError('');
        if (!isWebSerialSupported()) {
            setError('Serial needs Chrome or Edge.');
            return;
        }
        if (startingRef.current) {
            return;
        }
        startingRef.current = true;
        try {
            const portMod = await import('../../lib/web-serial/web-serial-port');
            if (!portMod.isConnected()) {
                setError('Connect the board first.');
                return;
            }
            const uploadState = await import('../../lib/web-serial/upload-state');
            if (uploadState.isUploadInProgress()) {
                setError('Wait for the upload to finish.');
                return;
            }
            const mon = await import('../../lib/web-serial/serial-monitor');
            muteUntilRef.current = Date.now() + RESET_HOLD_MS + BOOT_LOG_MS + 1000;
            await mon.startSerialMonitor(baudRate);
            setMonitoring(true);
            const restarted = await restartBoard(portMod.getPort());
            muteUntilRef.current = restarted ? Date.now() + BOOT_LOG_MS : 0;
            clearQuietTimer();
            if (!mountedRef.current) {
                return;
            }
            quietTimerRef.current = setTimeout(() => {
                quietTimerRef.current = null;
                if (mon.isSerialMonitoring()) {
                    setHint(QUIET_HINT);
                }
            }, QUIET_HINT_MS);
        } catch (err) {
            muteUntilRef.current = 0;
            setMonitoring(false);
            setError((err && err.message) || 'Could not start serial');
        } finally {
            startingRef.current = false;
        }
    }, [baudRate, clearQuietTimer]);

    const stop = useCallback(async () => {
        clearQuietTimer();
        try {
            const mon = await import('../../lib/web-serial/serial-monitor');
            await mon.stopSerialMonitor();
        } catch (err) {
            // ignore
        }
        setMonitoring(false);
    }, [clearQuietTimer]);

    const clear = useCallback(() => {
        bufferRef.current = '';
        setLines('');
    }, []);

    const sendLine = useCallback(async text => {
        if (!text) {
            return;
        }
        try {
            const mon = await import('../../lib/web-serial/serial-monitor');
            await mon.writeSerialMonitor(`${text}\n`);
        } catch (err) {
            setError((err && err.message) || 'Send failed');
        }
    }, []);

    return {
        lines,
        monitoring,
        error,
        hint,
        baudRate,
        supported: isWebSerialSupported(),
        canStart: Boolean(connected) && !monitoring,
        bottomRef,
        start,
        stop,
        clear,
        sendLine
    };
};

export default useSerialMonitor;
export {BEGINNER_BAUD};
