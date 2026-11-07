const MICROPYTHON = 'micropython';
const ARDUINO = 'arduino';
const UNKNOWN = 'unknown';
const TINKERBIT_FW = 'tinkerbit';
const STOCK_FW = 'stock';

// tinkerbit.API in prototypes/micropython/lib/tinkerbit/__init__.py: the library calls the
// generated main.py makes. A TinkerBit firmware with another API needs Update board.
const FIRMWARE_API = 1;

// Runs on any MicroPython, with or without the TinkerBit library. Only the TinkerBit firmware
// imports tinkerbit here: it is frozen there, while stock MicroPython would compile /lib.
const INFO_SCRIPT = 'import sys, json\n' +
    "try:\n lib = open('/tb_lib.txt').read()\nexcept OSError:\n lib = 'none'\n" +
    "try:\n import tbsys\n fw = 'tinkerbit'\nexcept ImportError:\n fw = 'stock'\n" +
    "api = 0\nver = ''\n" +
    "if fw == 'tinkerbit':\n try:\n  import tinkerbit\n  api = tinkerbit.API\n  ver = tinkerbit.VERSION\n" +
    ' except Exception:\n  pass\n' +
    "print('TB_INFO ' + json.dumps({'lang': 'micropython', " +
    "'mpy': '.'.join(str(v) for v in sys.implementation.version[:3]), " +
    "'machine': sys.implementation._machine, 'lib': lib, 'fw': fw, 'api': api, 'ver': ver}))\n";

// The ESP32 ROM prints this at 115200 after every reset, whatever program is on the chip:
// "ets Jun  8 2016 00:22:57" and "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)".
const ROM_BOOT = /rst:0x[0-9a-f]+|ets [A-Z][a-z]{2} /;

class WrongChipError extends Error {}

const askInfo = async link => {
    const out = await link.run(INFO_SCRIPT);
    const line = out.split(/\r?\n/).find(l => l.indexOf('TB_INFO ') === 0);
    if (!line) {
        throw new Error('The board did not report its info.');
    }
    return JSON.parse(line.slice('TB_INFO '.length));
};

// sys.implementation._machine ends with the chip: "Generic ESP32 module with ESP32".
const checkChip = info => {
    const machine = String(info.machine || '').trim();
    if (machine && !/\bESP32$/.test(machine)) {
        throw new WrongChipError(`This board is not the TinkerBit ESP32 (it reports "${machine}").`);
    }
};

/**
 * Find out what the board runs before sending anything.
 * @param {ReplLink} link started raw REPL link
 * @param {object} [options] {freshFirmware: true right after MicroPython was installed, onLog}
 * @returns {Promise<{lang: string, mpy: string, machine: string, lib: string, fw: string, api: number,
 *   ver: string}>} lang is micropython, arduino (no REPL but the ESP32 boot text) or unknown
 *   (silent board); fw is tinkerbit or stock, api and ver are the frozen library's
 */
const readBoardInfo = async (link, options = {}) => {
    let ok = await link.tryEnterRaw(options.freshFirmware ? 20000 : 2500);
    if (!ok) {
        if (options.onLog) options.onLog('No answer from MicroPython: restarting the board in safe mode\r\n');
        ok = await link.recover();
    }
    if (!ok) {
        return {lang: ROM_BOOT.test(link.bootLog) ? ARDUINO : UNKNOWN};
    }
    const info = await askInfo(link);
    checkChip(info);
    return info;
};

const hasTinkerBitFirmware = info => Boolean(info) && info.lang === MICROPYTHON && info.fw === TINKERBIT_FW;

// The TinkerBit firmware is on the board but its library speaks another API than this Studio.
const firmwareOutOfDate = info => hasTinkerBitFirmware(info) && Number(info.api) !== FIRMWARE_API;

const describeBoard = info => {
    if (info.lang === MICROPYTHON) {
        if (hasTinkerBitFirmware(info)) {
            return `TinkerBit firmware (library ${info.ver || '?'}, API ${info.api}), ` +
                `MicroPython ${info.mpy} on ${info.machine}`;
        }
        const lib = info.lib && info.lib !== 'none' ? `library ${info.lib}` : 'no TinkerBit library yet';
        return `MicroPython ${info.mpy} on ${info.machine}, ${lib}`;
    }
    return info.lang === ARDUINO ? 'Arduino program (no MicroPython)' : 'no answer from MicroPython';
};

export {
    ARDUINO,
    FIRMWARE_API,
    MICROPYTHON,
    STOCK_FW,
    TINKERBIT_FW,
    UNKNOWN,
    WrongChipError,
    describeBoard,
    firmwareOutOfDate,
    hasTinkerBitFirmware,
    readBoardInfo
};
