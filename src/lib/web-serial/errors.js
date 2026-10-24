/**
 * Normalize browser / compile / serial errors into user-facing messages.
 */
const normalizeWebSerialError = err => {
    if (!err) {
        return 'Unknown error';
    }
    if (typeof err === 'string') {
        return err;
    }

    const name = err.name || '';
    const message = err.message || String(err);

    if (name === 'NotFoundError' || /user (?:cancel|did not select)/i.test(message)) {
        return 'No port selected. Click Connect and choose your board in the browser list.';
    }
    if (name === 'SecurityError' || /secure context/i.test(message)) {
        return 'Web Serial needs HTTPS or localhost. Open the IDE at https://tinkerbit.io/ide or http://127.0.0.1:8601.';
    }
    if (/network|failed to fetch|load failed/i.test(message)) {
        return 'Cannot reach the compile server. Check your internet connection and try again.';
    }
    if (/locked|already open|in use|busy|failed to open serial port/i.test(message)) {
        return 'Serial port is busy. Close Arduino IDE Serial Monitor, Putty, or other browser tabs using this board, unplug/replug USB, then Connect again.';
    }
    if (/Failed to execute ['"]open['"] on ['"]SerialPort['"]/i.test(message)) {
        return 'Serial port is busy. Close Arduino IDE Serial Monitor, Putty, or other browser tabs using this board, unplug/replug USB, then Connect again.';
    }
    if (/failed to connect with the device|timed out|could not enter esp32 download|wrong boot mode/i.test(message)) {
        return 'Download mode failed on this laptop USB. Hold BOOT during Upload, try a USB2 port or another cable, then release BOOT when flashing starts.';
    }
    if (/timeout/i.test(message)) {
        return message;
    }
    return message;
};

export {
    normalizeWebSerialError
};
