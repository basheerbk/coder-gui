import {useCallback, useEffect, useRef, useState} from 'react';

import {isWebSerialSupported} from '../../lib/web-serial/supported-browsers';

const BEGINNER_BAUD = 9600; // matches Serial.begin(9600) in codegen

/**
 * Beginner Studio serial monitor — reuses Advanced IDE Web Serial monitor helpers.
 */
const useSerialMonitor = ({connected} = {}) => {
    const [lines, setLines] = useState('');
    const [monitoring, setMonitoring] = useState(false);
    const [error, setError] = useState('');
    const [baudRate] = useState(BEGINNER_BAUD);
    const bufferRef = useRef('');
    const bottomRef = useRef(null);

    const appendText = useCallback(chunk => {
        bufferRef.current += chunk;
        // Cap memory — keep last ~12k chars
        if (bufferRef.current.length > 12000) {
            bufferRef.current = bufferRef.current.slice(-10000);
        }
        setLines(bufferRef.current);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let removeHandler = null;
        let flashStart = null;
        let flashDone = null;

        (async () => {
            try {
                const mon = await import('../../lib/web-serial/serial-monitor');
                if (cancelled) {
                    return;
                }
                const decoder = new TextDecoder();
                const onBytes = value => {
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
                mon.webSerialMonitorEvents.addEventListener(mon.FLASH_START, flashStart);
                mon.webSerialMonitorEvents.addEventListener(mon.FLASH_COMPLETE, flashDone);
            } catch (err) {
                // ignore load errors until Start is clicked
            }
        })();

        return () => {
            cancelled = true;
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
                if (mon.isSerialMonitoring()) {
                    mon.stopSerialMonitor();
                }
            }).catch(() => {});
        };
    }, [appendText]);

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
        try {
            const portMod = await import('../../lib/web-serial/web-serial-port');
            if (!portMod.isConnected()) {
                setError('Connect the board first.');
                return;
            }
            const mon = await import('../../lib/web-serial/serial-monitor');
            await mon.startSerialMonitor(baudRate);
            setMonitoring(true);
        } catch (err) {
            setMonitoring(false);
            setError((err && err.message) || 'Could not start serial');
        }
    }, [baudRate]);

    const stop = useCallback(async () => {
        try {
            const mon = await import('../../lib/web-serial/serial-monitor');
            await mon.stopSerialMonitor();
        } catch (err) {
            // ignore
        }
        setMonitoring(false);
    }, []);

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
