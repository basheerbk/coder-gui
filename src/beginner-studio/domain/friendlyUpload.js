/**
 * Plain-language upload status for Beginner Studio. The raw text from the compile server and
 * esptool stays available under "Details"; beginners only see these short lines.
 */

const BOOT_TIP = 'Tip: some laptops need the BOOT button on the board held down while uploading.';

const ERRORS = [
    {re: /chrome or edge|not supported/i, text: 'Open this page in Chrome or Edge on a computer to upload.'},
    {re: /https|secure context/i, text: 'Open TinkerBit from https://tinkerbit.io to upload.'},
    {re: /no port selected|did not select|no web serial port/i,
        text: 'Pick your board in the list that pops up.'},
    {re: /already in progress/i, text: 'An upload is already running. Wait for it to finish.'},
    {re: /reach the compile|compile server|failed to fetch|network|load failed/i,
        text: 'Cannot reach TinkerBit to get your program ready. Check the internet and try again.'},
    {re: /busy|in use|locked|already open|failed to open serial/i,
        text: 'Close other apps using the board (like Arduino IDE), then try again.'},
    {re: /download mode|boot|timed out|could not enter|failed to connect with the device|wrong boot mode/i,
        tip: 'Keep holding BOOT until the percent starts going up. Still stuck? Try another USB port or cable.',
        text: 'Hold the BOOT button on the board and press Upload again.'},
    {re: /connect your board first/i, text: 'Plug in your board with the USB cable, then press Connect board.'},
    {re: /no code|code is empty|add blocks/i, text: 'Add some blocks first, then press Upload.'},
    {re: /cancel/i, text: 'Upload stopped.'},
    {re: /compile/i, text: 'Your program could not be prepared. Check your blocks and try again.'}
];

const UNKNOWN_ERROR = 'Something went wrong. Check the USB cable and try again.';

const busyText = message => {
    const m = String(message || '');
    if (/hold boot/i.test(m)) {
        return 'Hold the BOOT button on the board now…';
    }
    if (/cancel/i.test(m)) {
        return 'Stopping…';
    }
    if (/complete/i.test(m)) {
        return 'Almost done…';
    }
    if (/flash|writing|image|page/i.test(m)) {
        return 'Sending to your board…';
    }
    if (/bootloader|reset|sync/i.test(m)) {
        return 'Waking up your board…';
    }
    return 'Getting your program ready…';
};

/**
 * @param {{phase: string, message: string, connected: boolean, supported: boolean}} state upload hook state
 * @returns {{tone: string, text: string, tip: string}} tone is idle | busy | ok | error
 */
const friendlyUpload = ({phase, message, connected, supported}) => {
    if (!supported) {
        return {tone: 'error', text: ERRORS[0].text, tip: ''};
    }
    if (phase === 'connecting') {
        return {tone: 'busy', text: 'Pick your board in the list that pops up.', tip: ''};
    }
    if (phase === 'uploading') {
        return {tone: 'busy', text: busyText(message), tip: ''};
    }
    if (phase === 'success') {
        return {tone: 'ok', text: 'Done! Your board is running your program.', tip: ''};
    }
    if (phase === 'error') {
        const hit = ERRORS.find(e => e.re.test(String(message || '')));
        return {
            tone: 'error',
            text: hit ? hit.text : UNKNOWN_ERROR,
            tip: hit ? (hit.tip || '') : BOOT_TIP
        };
    }
    return {tone: 'idle', text: connected ? 'Board connected' : '', tip: ''};
};

export {BOOT_TIP, friendlyUpload};
