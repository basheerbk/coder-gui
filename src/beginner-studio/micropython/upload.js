import {FIRMWARE_API, MICROPYTHON, describeBoard, hasTinkerBitFirmware, readBoardInfo} from './boardInfo';
import {ReplLink} from './replLink';

// Ctrl-C stops the Python code but not the hardware: PWM keeps a motor spinning, a servo
// holding and a tone sounding. Arduino never had this, because every upload reset the chip.
const STOP_ALL = "import sys\n_tb_m=sys.modules.get('tinkerbit')\nif _tb_m:\n _tb_m.stop_all()\ndel _tb_m\n";

// Files a cut cable left half-written (writeFile writes <name>.tmp, then renames).
const REMOVE_TMP = 'import os\n' +
    'def _tb_w(d):\n' +
    ' for e in os.ilistdir(d):\n' +
    "  p=d.rstrip('/')+'/'+e[0]\n" +
    '  if e[1]==0x4000:\n   _tb_w(p)\n' +
    "  elif e[0].endswith('.tmp'):\n   os.remove(p)\n" +
    "_tb_w('/')\ndel _tb_w\n";

// A library copy from stock MicroPython days: the firmware's frozen library wins the import,
// but boot.py would still read the old pin table from /lib/tinkerbit/board.py.
const REMOVE_LIBRARY_COPY = 'import os\n' +
    'def _tb_rm(p):\n' +
    ' try:\n' +
    '  if os.stat(p)[0]&0x4000:\n' +
    "   for e in os.listdir(p):\n    _tb_rm(p+'/'+e)\n" +
    '   os.rmdir(p)\n' +
    '  else:\n   os.remove(p)\n' +
    ' except OSError:\n  pass\n' +
    "_tb_rm('/lib/tinkerbit')\n_tb_rm('/lib/ssd1306.py')\ndel _tb_rm\n";

const CONFIG_PATH = '/config.json';

const removeFiles = paths => 'import os\n' +
    `for p in ${JSON.stringify(paths)}:\n` +
    ' try:\n  os.remove(p)\n  print(\'TB_RM \' + p)\n except OSError:\n  pass\n';

const STAMP_PATH = '/tb_lib.txt';

const NO_MICROPYTHON = 'This board does not have MicroPython. Choose Update board in the menu at the top right.';
const CLOUD_NEEDS_FIRMWARE = 'Cloud needs the TinkerBit firmware on the board. ' +
    'Choose Update board in the menu at the top right.';
const OLDER_FIRMWARE = 'This board has an older TinkerBit firmware. Choose Update board in the menu at the top right.';
const NEWER_FIRMWARE = 'This board has a newer TinkerBit firmware than this page. Reload the page, then Upload again.';

// The board is not ready for this upload; info is what readBoardInfo found.
class NoMicroPythonError extends Error {
    constructor (message, info) {
        super(message);
        this.info = info;
    }
}

const encoder = new TextEncoder();

const quiet = () => {};

// Run task(link, info) on a board that answered as MicroPython; the link is always closed.
const withMicroPython = async ({port, isAborted, onLog, freshFirmware}, task) => {
    const log = onLog || quiet;
    const link = new ReplLink(port, {isAborted});
    await link.start();
    try {
        const info = await readBoardInfo(link, {freshFirmware, onLog: log});
        log(`Board: ${describeBoard(info)}\r\n`);
        if (info.lang !== MICROPYTHON) {
            throw new NoMicroPythonError(NO_MICROPYTHON, info);
        }
        await link.run(REMOVE_TMP);
        return await task(link, info);
    } finally {
        await link.stop();
    }
};

// What a board needs from the library: everything on stock MicroPython, only boot.py on the
// TinkerBit firmware (the rest is frozen in).
const libraryFor = (info, library) => (hasTinkerBitFirmware(info) && library.firmwareFiles ?
    {files: library.firmwareFiles, stamp: library.firmwareStamp, frozen: true} :
    {files: library.files, stamp: library.stamp, frozen: false});

// Write the library unless the board already has this version. Returns true when it wrote.
const writeLibrary = async (link, info, library, progress, log, from, to) => {
    const onBoard = String(info.lib || 'none').trim();
    const wanted = libraryFor(info, library);
    if (onBoard === wanted.stamp) {
        return false;
    }
    if (wanted.frozen) {
        await link.run(REMOVE_LIBRARY_COPY);
        log('Setting up the TinkerBit firmware files\r\n');
    } else {
        log(`Installing the TinkerBit library (${onBoard === 'none' ? 'not on the board' : 'update'})\r\n`);
    }
    for (let i = 0; i < wanted.files.length; i++) {
        const file = wanted.files[i];
        progress(`Installing the TinkerBit library (${i + 1}/${wanted.files.length})…`,
            from + Math.round((i / wanted.files.length) * (to - from)));
        await link.writeFile(file.path, encoder.encode(file.text));
        log(`  wrote ${file.path}\r\n`);
    }
    await link.writeFile(STAMP_PATH, encoder.encode(wanted.stamp));
    return true;
};

// Why this board cannot take this program yet, or null.
const notReadyFor = (info, config) => {
    if (hasTinkerBitFirmware(info)) {
        const api = Number(info.api);
        if (api < FIRMWARE_API || !Number.isFinite(api)) {
            return OLDER_FIRMWARE;
        }
        if (api > FIRMWARE_API) {
            return NEWER_FIRMWARE;
        }
        return null;
    }
    return config ? CLOUD_NEEDS_FIRMWARE : null;
};

/**
 * Put a program on a MicroPython board and start it. A board that is not ready throws
 * NoMicroPythonError: the user runs Update board.
 * @param {object} args upload settings
 * @param {SerialPort} args.port open Web Serial port at 115200
 * @param {string} args.source main.py
 * @param {object} args.library tinkerbit library (libraryFiles.js)
 * @param {object} [args.config] Cloud settings for /config.json (WiFi, device key); without it
 *   an earlier project's /config.json is removed. Never logged.
 * @param {Function} [args.onProgress] (text, percent)
 * @param {Function} [args.onLog] (text)
 * @param {Function} [args.isAborted] () => boolean
 * @returns {Promise<{info: object, libraryInstalled: boolean, programError: string, output: string}>}
 *   info is the board info read first; programError is the error line when the program stopped
 *   right after starting; output is what it printed in that time
 */
const uploadMicroPython = ({port, source, library, config, onProgress, onLog, isAborted}) => {
    const progress = onProgress || quiet;
    const log = onLog || quiet;
    progress('Checking your board…', 5);
    return withMicroPython({port, isAborted, onLog: log}, async (link, info) => {
        const problem = notReadyFor(info, config);
        if (problem) {
            throw new NoMicroPythonError(problem, info);
        }
        await link.run(STOP_ALL);
        const libraryInstalled = await writeLibrary(link, info, library, progress, log, 10, 75);

        if (config) {
            progress('Sending the Cloud settings…', 80);
            await link.writeFile(CONFIG_PATH, encoder.encode(JSON.stringify(config)));
            log(`Wrote the Cloud settings to ${CONFIG_PATH}\r\n`);
        } else {
            const out = await link.run(removeFiles([CONFIG_PATH]));
            if (out.indexOf(`TB_RM ${CONFIG_PATH}`) !== -1) {
                log('Removed the Cloud settings of an earlier project\r\n');
            }
        }

        progress('Sending your program…', 85);
        const data = encoder.encode(source);
        await link.writeFile('/main.py', data);
        log(`Wrote /main.py (${data.length} bytes)\r\n`);

        progress('Starting your program…', 95);
        await link.softResetRunMain();
        const programError = await link.errorWithin(1500);
        return {info, libraryInstalled, programError, output: link.received()};
    });
};

/**
 * Read the board info for Update board. A MicroPython program that was stopped to ask is
 * started again.
 * @param {object} args {port, isAborted, onLog}
 * @returns {Promise<object>} board info: lang is micropython, arduino or unknown
 */
const checkBoard = async args => {
    try {
        return await withMicroPython(args, async (link, info) => {
            await link.softResetRunMain();
            return info;
        });
    } catch (err) {
        if (err instanceof NoMicroPythonError) {
            return err.info;
        }
        throw err;
    }
};

/**
 * Second half of Update board, right after the firmware was flashed: wait for the first boot
 * (it formats a fresh disk), put the library files on and remove the old program and its Cloud
 * settings (flashing keeps the disk of a board that already had MicroPython).
 * @param {object} args {port, library, onProgress, onLog, isAborted}
 * @returns {Promise<object>} board info
 */
const installLibrary = async ({port, library, onProgress, onLog, isAborted}) => {
    const progress = onProgress || quiet;
    const log = onLog || quiet;
    try {
        return await withMicroPython({port, isAborted, onLog: log, freshFirmware: true}, async (link, info) => {
            await writeLibrary(link, info, library, progress, log, 0, 100);
            const out = await link.run(removeFiles(['/main.py', CONFIG_PATH]));
            if (out.indexOf('TB_RM ') !== -1) {
                log('Removed the old program from the board\r\n');
            }
            await link.softResetRunMain();
            return Object.assign({}, info, {lib: libraryFor(info, library).stamp});
        });
    } catch (err) {
        if (err instanceof NoMicroPythonError) {
            throw new Error('MicroPython did not start after installing. ' +
                'Unplug the board, plug it back in, then press Update board again.');
        }
        throw err;
    }
};

export {CONFIG_PATH, NoMicroPythonError, STAMP_PATH, checkBoard, installLibrary, uploadMicroPython};
