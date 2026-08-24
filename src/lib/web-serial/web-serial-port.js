import {isWebSerialSupported} from './supported-browsers';
import {normalizeWebSerialError} from './errors';

let activePort = null;
let activeLabel = null;
let disconnectHandler = null;

const SERIAL_FILTERS = [
    {usbVendorId: 0x2341}, // Arduino
    {usbVendorId: 0x2A03}, // Arduino.org
    {usbVendorId: 0x1B4F}, // SparkFun
    {usbVendorId: 0x16C0}, // Van Ooijen / some clones
    {usbVendorId: 0x1A86}, // WCH CH340 / CH9102
    {usbVendorId: 0x0403}, // FTDI
    {usbVendorId: 0x10C4}, // Silicon Labs CP210x
    {usbVendorId: 0x303A} // Espressif USB-JTAG/serial (ESP32-S3)
];

const serialOpenOptions = baudRate => ({
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 65536,
    flowControl: 'none'
});

const formatPortLabel = port => {
    const info = port.getInfo();
    const vid = info.usbVendorId != null ? info.usbVendorId.toString(16).padStart(4, '0') : '????';
    const pid = info.usbProductId != null ? info.usbProductId.toString(16).padStart(4, '0') : '????';
    return `WebSerial ${vid}:${pid}`;
};

const attachDisconnectListener = port => {
    if (!navigator.serial || typeof navigator.serial.addEventListener !== 'function') {
        return;
    }
    if (disconnectHandler) {
        navigator.serial.removeEventListener('disconnect', disconnectHandler);
    }
    disconnectHandler = event => {
        if (activePort && event.port === activePort) {
            activePort = null;
            activeLabel = null;
        }
    };
    navigator.serial.addEventListener('disconnect', disconnectHandler);
};

const requestAndOpenPort = async (baudRate = 115200) => {
    if (!isWebSerialSupported()) {
        throw new Error('Web Serial is not supported in this browser. Use Chrome or Edge on a computer.');
    }
    await closePort();
    let port;
    try {
        port = await navigator.serial.requestPort({filters: SERIAL_FILTERS});
    } catch (err) {
        throw new Error(normalizeWebSerialError(err));
    }
    try {
        await port.open(serialOpenOptions(baudRate));
    } catch (err) {
        throw new Error(normalizeWebSerialError(err));
    }
    activePort = port;
    activeLabel = formatPortLabel(port);
    attachDisconnectListener(port);
    return {port, label: activeLabel};
};

const openExistingPort = async (baudRate = 115200) => {
    if (!activePort) {
        throw new Error('No Web Serial port selected.');
    }
    if (!activePort.readable) {
        try {
            await activePort.open(serialOpenOptions(baudRate));
        } catch (err) {
            throw new Error(normalizeWebSerialError(err));
        }
    }
    return activePort;
};

const reopenPort = async (baudRate = 115200) => {
    if (!activePort) {
        throw new Error('No Web Serial port selected.');
    }
    try {
        if (activePort.readable || activePort.writable) {
            await activePort.close();
        }
    } catch (e) {
        // already closed
    }
    await new Promise(r => setTimeout(r, 100));
    try {
        await activePort.open(serialOpenOptions(baudRate));
    } catch (err) {
        throw new Error(normalizeWebSerialError(err));
    }
    return activePort;
};

const closePort = async (options = {}) => {
    const forget = options.forget !== false;
    if (!activePort) return;
    try {
        if (activePort.readable || activePort.writable) {
            await activePort.close();
        }
    } catch (e) {
        // Port may already be closed after flash.
    }
    if (forget) {
        activePort = null;
        activeLabel = null;
    }
};

const getPort = () => activePort;
const getPortLabel = () => activeLabel;
const isConnected = () => Boolean(activePort);

const resetBootloader = async port => {
    try {
        await port.setSignals({dataTerminalReady: false, requestToSend: false});
        await new Promise(r => setTimeout(r, 250));
        await port.setSignals({dataTerminalReady: true, requestToSend: true});
        await new Promise(r => setTimeout(r, 50));
    } catch (e) {
        // Some Windows USB-serial drivers ignore setSignals; open() still resets.
    }
};

export {
    requestAndOpenPort,
    openExistingPort,
    reopenPort,
    closePort,
    getPort,
    getPortLabel,
    isConnected,
    resetBootloader,
    formatPortLabel,
    SERIAL_FILTERS
};
