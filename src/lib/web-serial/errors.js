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
    if (/locked|already open|in use|busy/i.test(message)) {
        return 'Serial port is in use. Close the Arduino IDE, serial monitor, or other tabs using this port.';
    }
    if (/timeout/i.test(message)) {
        return message;
    }
    return message;
};

export {
    normalizeWebSerialError
};
