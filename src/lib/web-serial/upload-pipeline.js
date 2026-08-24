import {compileSketch} from './compile-client';
import {getDeviceFqbn, getDeviceProtocol} from './device-profiles';
import {normalizeWebSerialError} from './errors';
import {
    beginUpload,
    endUpload,
    isAbortRequested
} from './upload-state';
import {
    closePort,
    getPort,
    reopenPort,
    resetBootloader
} from './web-serial-port';
import {flashHexOnPort} from './stk500-flash';
import {flashEspImagesOnPort} from './esptool-flash';
import {notifyFlashComplete, notifyFlashStarting} from './serial-monitor';

const UNO_FLASH_BAUD_RATES = [115200, 57600];

const throwIfAborted = () => {
    if (isAbortRequested()) {
        throw new Error('Upload cancelled.');
    }
};

const tryFlashUnoAtBaud = async (hex, baudRate, onProgress, onLog) => {
    if (onLog) onLog(`Opening serial at ${baudRate} baud…\r\n`);
    const port = await reopenPort(baudRate);
    await resetBootloader(port);
    await flashHexOnPort(port, hex, (message, pct) => {
        if (onLog) onLog(`${message}\r\n`);
        if (onProgress) onProgress(message, pct);
    });
};

const flashUno = async (hex, onProgress, onLog) => {
    let lastError = null;
    for (let i = 0; i < UNO_FLASH_BAUD_RATES.length; i++) {
        throwIfAborted();
        const baudRate = UNO_FLASH_BAUD_RATES[i];
        try {
            await tryFlashUnoAtBaud(hex, baudRate, onProgress, onLog);
            return;
        } catch (err) {
            lastError = err;
            if (onLog) onLog(`${normalizeWebSerialError(err)}\r\n`);
            if (i < UNO_FLASH_BAUD_RATES.length - 1 && onLog) {
                onLog('Retrying with older Uno bootloader baud…\r\n');
            }
        }
    }
    throw lastError;
};

const flashEsp32 = async (firmware, onProgress, onLog) => {
    throwIfAborted();
    if (onLog) onLog('Resetting into ESP32 download mode…\r\n');
    await closePort({forget: false});
    const port = getPort();
    if (!port) {
        throw new Error('Connect your board first (Web Serial).');
    }
    await flashEspImagesOnPort(port, firmware, onProgress, onLog);
};

const uploadSketchWebSerial = async (deviceId, source, onProgress, onLog) => {
    if (!beginUpload()) {
        throw new Error('Upload already in progress.');
    }

    try {
        const fqbn = getDeviceFqbn(deviceId);
        const protocol = getDeviceProtocol(deviceId);
        if (!getPort()) {
            throw new Error('Connect your board first (Web Serial).');
        }

        throwIfAborted();
        if (onProgress) onProgress('Compiling on server…', 0);
        if (onLog) onLog('Compiling sketch…\r\n');

        const result = await compileSketch(source, fqbn);
        throwIfAborted();
        if (result.log && onLog) onLog(`${result.log}\r\n`);
        if (onLog) onLog('Compile OK. Flashing…\r\n');

        await notifyFlashStarting();

        try {
            if (protocol === 'esptool' || result.format === 'esptool') {
                await flashEsp32(result, onProgress, onLog);
            } else {
                if (!result.hex) {
                    throw new Error('Compile returned no HEX file.');
                }
                await flashUno(result.hex, onProgress, onLog);
            }
        } finally {
            try {
                await closePort({forget: false});
            } catch (e) {
                // ignore
            }
            notifyFlashComplete();
        }
    } catch (err) {
        const wrapped = new Error(normalizeWebSerialError(err));
        if (err && err.log) {
            wrapped.log = err.log;
        }
        throw wrapped;
    } finally {
        endUpload();
    }
};

export {
    uploadSketchWebSerial
};
