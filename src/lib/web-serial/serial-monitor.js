import {getPort, reopenPort} from './web-serial-port';

const FLASH_START = 'flash-start';
const FLASH_COMPLETE = 'flash-complete';
const MONITOR_START = 'monitor-start';
const MONITOR_STOP = 'monitor-stop';

const webSerialMonitorEvents = new EventTarget();

let monitorReader = null;
let monitorWriter = null;
let isMonitoring = false;
let currentBaudRate = 9600;
let dataHandler = null;
const listeners = new Set();

const delay = ms => new Promise(r => setTimeout(r, ms));

const releaseLocks = async () => {
    if (isMonitoring) {
        webSerialMonitorEvents.dispatchEvent(new Event(MONITOR_STOP));
    }
    isMonitoring = false;

    if (monitorReader) {
        try {
            await monitorReader.cancel();
        } catch (e) {
            // ignore
        }
        try {
            monitorReader.releaseLock();
        } catch (e) {
            // ignore
        }
        monitorReader = null;
    }

    if (monitorWriter) {
        try {
            monitorWriter.releaseLock();
        } catch (e) {
            // ignore
        }
        monitorWriter = null;
    }
};

const pump = async () => {
    const port = getPort();
    if (!port || !port.readable) {
        return;
    }

    monitorReader = port.readable.getReader();
    if (port.writable && !port.writable.locked) {
        monitorWriter = port.writable.getWriter();
    }

    try {
        while (isMonitoring && monitorReader) {
            const {value, done} = await monitorReader.read();
            if (done) {
                break;
            }
            if (value && value.length) {
                if (dataHandler) {
                    dataHandler(value);
                }
                listeners.forEach(fn => fn(value));
            }
        }
    } catch (e) {
        // Cancelled when flashing or disconnecting.
    } finally {
        if (monitorReader) {
            try {
                monitorReader.releaseLock();
            } catch (e) {
                // ignore
            }
            monitorReader = null;
        }
    }
};

/**
 * Bytes from the Arduino are forwarded to the existing Hardware Console.
 */
const setSerialDataHandler = handler => {
    dataHandler = handler;
};

/** Extra readers (for example the Cloud go-live checklist) that see the same bytes. */
const addSerialDataListener = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

const startSerialMonitor = async (baudRate = 9600) => {
    if (!getPort()) {
        throw new Error('Connect your Arduino first (Web Serial).');
    }

    await releaseLocks();
    currentBaudRate = baudRate;
    await reopenPort(baudRate);
    await delay(50);

    isMonitoring = true;
    webSerialMonitorEvents.dispatchEvent(new Event(MONITOR_START));
    pump();
};

const stopSerialMonitor = async () => {
    await releaseLocks();
};

const writeSerialMonitor = async data => {
    const port = getPort();
    if (!port || !port.writable) {
        throw new Error('Serial port is not open.');
    }
    if (!monitorWriter) {
        if (port.writable.locked) {
            throw new Error('Serial port writer is locked.');
        }
        monitorWriter = port.writable.getWriter();
    }
    const bytes = typeof data === 'string' ?
        new TextEncoder().encode(data) :
        data;
    await monitorWriter.write(bytes);
};

const isSerialMonitoring = () => isMonitoring;
const getMonitorBaudRate = () => currentBaudRate;

const notifyFlashStarting = async () => {
    webSerialMonitorEvents.dispatchEvent(new Event(FLASH_START));
    await stopSerialMonitor();
};

const notifyFlashComplete = () => {
    webSerialMonitorEvents.dispatchEvent(new Event(FLASH_COMPLETE));
};

export {
    FLASH_START,
    FLASH_COMPLETE,
    MONITOR_START,
    MONITOR_STOP,
    webSerialMonitorEvents,
    addSerialDataListener,
    setSerialDataHandler,
    startSerialMonitor,
    stopSerialMonitor,
    writeSerialMonitor,
    isSerialMonitoring,
    getMonitorBaudRate,
    notifyFlashStarting,
    notifyFlashComplete
};
