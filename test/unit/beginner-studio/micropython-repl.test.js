/* eslint-disable no-control-regex */
import {TextDecoder as UtilDecoder, TextEncoder as UtilEncoder} from 'util';

jest.mock('../../../src/lib/web-serial/esptool-flash', () => ({flashEspImagesOnPort: jest.fn()}));

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = UtilEncoder;
    global.TextDecoder = UtilDecoder;
}
if (typeof global.btoa === 'undefined') {
    global.btoa = text => Buffer.from(text, 'binary').toString('base64');
}

const {createHash, webcrypto} = require('crypto');
const fs = require('fs');
const path = require('path');
const {flashEspImagesOnPort} = require('../../../src/lib/web-serial/esptool-flash');
const {ReplLink, lastLine} = require('../../../src/beginner-studio/micropython/replLink');
const {CONFIG_PATH, NoMicroPythonError, STAMP_PATH, checkBoard, installLibrary, uploadMicroPython} =
    require('../../../src/beginner-studio/micropython/upload');
const {FIRMWARE_SHA256, FIRMWARE_URL, firmwareImages, forgetBundledFirmware, installFirmware} =
    require('../../../src/beginner-studio/micropython/installFirmware');
const {FIRMWARE_API} = require('../../../src/beginner-studio/micropython/boardInfo');
const {friendlyUpload} = require('../../../src/beginner-studio/domain/friendlyUpload');

if (!global.crypto || !global.crypto.subtle) {
    global.crypto = webcrypto;
}

const ROM_TEXT = 'ets Jul 29 2019 12:21:46\r\n\r\nrst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\r\n';

/**
 * A MicroPython board behind a Web Serial port: friendly and raw REPL, files, soft reset,
 * and boot.py's TB_SAFE answer after a hard reset. `micropython: false` is an Arduino board;
 * `rom: false` is a board that prints nothing after a reset; `fw: 'tinkerbit'` has the TinkerBit
 * firmware with library API `api`.
 */
class FakeBoard {
    constructor ({micropython = true, deaf = false, rom = true, machine = 'Generic ESP32 module with ESP32',
        files = {}, fw = 'stock', api = FIRMWARE_API} = {}) {
        this.micropython = micropython;
        this.deaf = deaf;
        this.rom = rom;
        this.machine = machine;
        this.fw = fw;
        this.api = api;
        this.files = Object.assign({}, files);
        this.mode = 'running';
        this.code = '';
        this.line = '';
        this.ran = [];
        this.signals = {dataTerminalReady: true, requestToSend: true};
        this.pending = [];
        this.waiting = null;
        this.cancelled = false;
        this.opened = null;
        this.readable = {getReader: () => this.reader()};
        this.writable = {getWriter: () => ({write: data => this.receive(data), releaseLock: () => {}})};
    }

    reader () {
        this.cancelled = false;
        return {
            read: () => {
                if (this.pending.length) {
                    return Promise.resolve({value: this.pending.shift(), done: false});
                }
                if (this.cancelled) {
                    return Promise.resolve({done: true});
                }
                return new Promise(resolve => {
                    this.waiting = resolve;
                });
            },
            cancel: () => {
                this.cancelled = true;
                if (this.waiting) {
                    this.waiting({done: true});
                    this.waiting = null;
                }
                return Promise.resolve();
            },
            releaseLock: () => {}
        };
    }

    emit (text) {
        const value = new TextEncoder().encode(text);
        if (this.waiting) {
            this.waiting({value, done: false});
            this.waiting = null;
        } else {
            this.pending.push(value);
        }
    }

    setSignals (s) {
        const wasReset = this.signals.requestToSend && !this.signals.dataTerminalReady;
        Object.assign(this.signals, s);
        if (wasReset && !this.signals.requestToSend) {
            this.boot();
        }
        return Promise.resolve();
    }

    boot () {
        this.deaf = false;
        this.mode = this.micropython ? 'booting' : 'running';
        this.line = '';
        if (this.rom) {
            this.emit(ROM_TEXT);
        }
    }

    // What esptool leaves behind: the TinkerBit firmware at its prompt. A board that had
    // MicroPython keeps its disk; one that ran Arduino gets a freshly formatted one.
    installMicroPython () {
        if (!this.micropython) {
            this.files = {};
        }
        this.micropython = true;
        this.fw = 'tinkerbit';
        this.api = FIRMWARE_API;
        this.mode = 'friendly';
        this.emit('MicroPython v1.24.1 on 2024-11-29; Generic ESP32 module with ESP32\r\n>>> ');
    }

    receive (data) {
        const text = new TextDecoder().decode(data);
        for (const ch of text) {
            this.byte(ch);
        }
        return Promise.resolve();
    }

    byte (ch) {
        if (!this.micropython) {
            return;
        }
        if (this.mode === 'booting') {
            this.line += ch;
            if (this.line.endsWith('TB_SAFE\n')) {
                this.emit('TB_SAFE_OK\r\n>>> ');
                this.mode = 'friendly';
            }
            return;
        }
        if (this.mode === 'running') {
            if (ch === '\x03' && !this.deaf) {
                this.emit('\r\nKeyboardInterrupt\r\n>>> ');
                this.mode = 'friendly';
            }
            return;
        }
        if (this.mode === 'friendly') {
            if (ch === '\x01') {
                this.mode = 'raw';
                this.code = '';
                this.emit('\r\nraw REPL; CTRL-B to exit\r\n>');
            } else if (ch === '\x04') {
                this.emit('MPY: soft reboot\r\n');
                this.runMain();
            }
            return;
        }
        if (ch === '\x02') {
            this.mode = 'friendly';
            this.emit('\r\nMicroPython v1.24.1 on 2024-11-29; ESP32\r\nType "help()" for more information.\r\n>>> ');
        } else if (ch === '\x01' || ch === '\x03') {
            this.code = '';
        } else if (ch === '\x04') {
            this.emit('OK');
            const {out, err} = this.exec(this.code);
            this.code = '';
            this.emit(`${out}\x04${err}\x04>`);
        } else {
            this.code += ch;
        }
    }

    exec (code) {
        this.ran.push(code);
        if (code.indexOf("'TB_INFO '") >= 0) {
            const stamp = this.files[STAMP_PATH];
            const tinkerbit = this.fw === 'tinkerbit';
            const info = {
                lang: 'micropython',
                mpy: '1.24.1',
                machine: this.machine,
                lib: typeof stamp === 'string' ? stamp : 'none',
                fw: this.fw,
                api: tinkerbit ? this.api : 0,
                ver: tinkerbit ? '0.1.0' : ''
            };
            return {out: `TB_INFO ${JSON.stringify(info)}\r\n`, err: ''};
        }
        const removeList = /^for p in (\[.*\]):/m.exec(code);
        if (removeList) {
            const removed = JSON.parse(removeList[1]).filter(p => p in this.files);
            removed.forEach(p => delete this.files[p]);
            return {out: removed.map(p => `TB_RM ${p}\r\n`).join(''), err: ''};
        }
        (code.match(/^_tb_rm\('([^']+)'\)$/gm) || []).forEach(call => {
            const target = /'([^']+)'/.exec(call)[1];
            Object.keys(this.files).filter(k => k === target || k.indexOf(`${target}/`) === 0)
                .forEach(k => delete this.files[k]);
        });
        let open = null;
        code.split('\n').forEach(line => {
            let m = /^_tb_f=open\("([^"]+)",?'wb'\)/.exec(line);
            if (m) {
                open = m[1];
                this.files[open] = '';
            }
            m = /^_tb_f\.write\(_tb_d\('([^']*)'\)\)/.exec(line);
            if (m) {
                const last = Object.keys(this.files).filter(k => k.endsWith('.tmp'))
                    .pop();
                this.files[open || last] += Buffer.from(m[1], 'base64').toString('utf8');
            }
            m = /^os\.rename\("([^"]+)","([^"]+)"\)/.exec(line);
            if (m) {
                this.files[m[2]] = this.files[m[1]];
                delete this.files[m[1]];
            }
        });
        return {out: '', err: ''};
    }

    runMain () {
        this.mode = 'running';
        const main = this.files['/main.py'] || '';
        if (main.indexOf('cloud.begin()') >= 0) {
            this.emit('Cloud: joining WiFi "SchoolNet"\r\n');
        }
        if (main.indexOf('raise') >= 0) {
            this.emit('Traceback (most recent call last):\r\n  File "main.py", line 3, in <module>\r\n' +
                'TinkerBitError: D13 is already used by Led\r\nMicroPython v1.24.1\r\n>>> ');
            this.mode = 'friendly';
        }
    }
}

const library = {
    files: [
        {path: '/lib/tinkerbit/__init__.py', text: `# library\n${'x = 1\n'.repeat(900)}`},
        {path: '/boot.py', text: 'import tinkerbit\n'}
    ],
    stamp: 'studio-test1',
    firmwareFiles: [{path: '/boot.py', text: 'import tinkerbit\n'}],
    firmwareStamp: 'fw-test1'
};

const stockInfo = (board, lib) => ({
    lang: 'micropython',
    mpy: '1.24.1',
    machine: board.machine,
    lib,
    fw: 'stock',
    api: 0,
    ver: ''
});
const firmwareInfo = (board, lib) => ({
    lang: 'micropython',
    mpy: '1.24.1',
    machine: board.machine,
    lib,
    fw: 'tinkerbit',
    api: FIRMWARE_API,
    ver: '0.1.0'
});

// Test values only: the shapes Studio checks, never a real network or device key.
const CLOUD_CONFIG = {
    wifi_ssid: 'SchoolNet',
    wifi_password: 'test-wifi-pass',
    host: 'cloud.example.test',
    port: 8883,
    ws_path: '/mqtt',
    device_id: 'd_abcdefghij',
    token: `tbd_${'T'.repeat(43)}`,
    interval_sec: 10,
    min_interval_sec: 5
};

const failure = promise => promise.then(() => null, err => err);

const upload = (board, extra) => uploadMicroPython(Object.assign({
    port: board,
    source: 'import tinkerbit\nwhile True:\n    pass\n',
    library
}, extra));

describe('MicroPython upload over the raw REPL', () => {
    test('a new board gets the library, the stamp and main.py, then runs it', async () => {
        const board = new FakeBoard();
        const steps = [];
        const result = await upload(board, {onProgress: text => steps.push(text)});
        expect(result.libraryInstalled).toBe(true);
        expect(result.programError).toBe('');
        expect(result.info).toEqual(stockInfo(board, 'none'));
        expect(board.files['/lib/tinkerbit/__init__.py']).toBe(library.files[0].text);
        expect(board.files['/boot.py']).toBe('import tinkerbit\n');
        expect(board.files[STAMP_PATH]).toBe('studio-test1');
        expect(board.files['/main.py']).toContain('while True:');
        expect(Object.keys(board.files).filter(k => k.endsWith('.tmp'))).toEqual([]);
        expect(board.mode).toBe('running');
        expect(steps[steps.length - 1]).toMatch(/Starting/);
        expect(board.ran.some(code => code.indexOf('stop_all()') >= 0)).toBe(true);
        expect(board.cancelled).toBe(true);
    });

    test('a big file goes over in several small commands', async () => {
        const board = new FakeBoard();
        await upload(board);
        const libWrites = board.ran.filter(code => code.indexOf('_tb_f.write') >= 0);
        expect(libWrites.length).toBeGreaterThan(3);
        libWrites.forEach(code => expect(code.length).toBeLessThan(4096));
    });

    test('the next upload only sends main.py', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-test1'}});
        const result = await upload(board, {source: 'print(2)\n'});
        expect(result.libraryInstalled).toBe(false);
        expect(board.files['/boot.py']).toBeUndefined();
        expect(board.files['/main.py']).toBe('print(2)\n');
    });

    test('an old library is replaced', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-old'}});
        const result = await upload(board);
        expect(result.libraryInstalled).toBe(true);
        expect(board.files[STAMP_PATH]).toBe('studio-test1');
    });

    test('a program that stops at once reports its error line', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-test1'}});
        const result = await upload(board, {source: 'raise TinkerBitError("x")\n'});
        expect(result.programError).toBe('TinkerBitError: D13 is already used by Led');
    });

    test('a board that ignores Ctrl-C is reset into safe mode', async () => {
        const board = new FakeBoard({deaf: true, files: {[STAMP_PATH]: 'studio-test1'}});
        const logs = [];
        const result = await upload(board, {onLog: text => logs.push(text)});
        expect(result.programError).toBe('');
        expect(logs.join('')).toMatch(/safe mode/);
        expect(board.files['/main.py']).toContain('while True:');
    }, 15000);

    test('a board running Arduino is reported as arduino from its boot text', async () => {
        const board = new FakeBoard({micropython: false});
        const err = await failure(upload(board));
        expect(err).toBeInstanceOf(NoMicroPythonError);
        expect(err.info).toEqual({lang: 'arduino'});
        expect(board.cancelled).toBe(true);
    }, 15000);

    test('a board that prints nothing is reported as unknown', async () => {
        const err = await failure(upload(new FakeBoard({micropython: false, rom: false})));
        expect(err).toBeInstanceOf(NoMicroPythonError);
        expect(err.info).toEqual({lang: 'unknown'});
    }, 15000);

    test('Cancel stops the upload', async () => {
        const board = new FakeBoard();
        const err = await failure(upload(board, {isAborted: () => true}));
        expect(err.message).toMatch(/cancelled/);
    });
});

describe('TinkerBit firmware and Cloud settings', () => {
    const cloudSource = 'from tinkerbit import cloud\ncloud.begin()\nwhile True:\n    pass\n';

    test('a TinkerBit firmware board gets boot.py instead of a library copy, once', async () => {
        const board = new FakeBoard({
            fw: 'tinkerbit',
            files: {
                [STAMP_PATH]: 'studio-test1',
                '/lib/tinkerbit/__init__.py': 'old',
                '/lib/tinkerbit/board.py': 'old pins',
                '/lib/ssd1306.py': 'old'
            }
        });
        const logs = [];
        const first = await upload(board, {onLog: text => logs.push(text)});
        expect(first.libraryInstalled).toBe(true);
        expect(first.info).toEqual(firmwareInfo(board, 'studio-test1'));
        expect(Object.keys(board.files).filter(k => k.indexOf('/lib/') === 0)).toEqual([]);
        expect(board.files['/boot.py']).toBe('import tinkerbit\n');
        expect(board.files[STAMP_PATH]).toBe('fw-test1');
        expect(logs.join('')).toContain(`Board: TinkerBit firmware (library 0.1.0, API ${FIRMWARE_API})`);

        const second = await upload(board, {source: 'print(2)\n'});
        expect(second.libraryInstalled).toBe(false);
        expect(board.files['/main.py']).toBe('print(2)\n');
    });

    test('a Cloud upload writes /config.json and never logs the secrets', async () => {
        const board = new FakeBoard({fw: 'tinkerbit', files: {[STAMP_PATH]: 'fw-test1'}});
        const logs = [];
        const steps = [];
        const result = await upload(board, {
            source: cloudSource,
            config: CLOUD_CONFIG,
            onLog: text => logs.push(text),
            onProgress: text => steps.push(text)
        });
        expect(result.programError).toBe('');
        expect(JSON.parse(board.files[CONFIG_PATH])).toEqual(CLOUD_CONFIG);
        expect(board.files['/main.py']).not.toContain(CLOUD_CONFIG.wifi_password);
        expect(board.files['/main.py']).not.toContain(CLOUD_CONFIG.token);
        const shown = logs.concat(steps).join('');
        expect(shown).toMatch(/Wrote the Cloud settings/);
        expect(shown).not.toContain(CLOUD_CONFIG.wifi_password);
        expect(shown).not.toContain(CLOUD_CONFIG.token);
        expect(result.output).toContain('Cloud: joining WiFi "SchoolNet"');
    });

    test('Cloud on stock MicroPython points to Update board and writes nothing', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-test1', '/main.py': 'print(1)\n'}});
        const err = await failure(upload(board, {source: cloudSource, config: CLOUD_CONFIG}));
        expect(err).toBeInstanceOf(NoMicroPythonError);
        expect(err.message).toMatch(/Cloud needs the TinkerBit firmware.*Update board/);
        expect(board.files[CONFIG_PATH]).toBeUndefined();
        expect(board.files['/main.py']).toBe('print(1)\n');
        const friendly = friendlyUpload({phase: 'error', message: err.message, connected: true, supported: true});
        expect(friendly.text).toMatch(/Update board/);
    });

    test('a project without Cloud removes an earlier project\'s Cloud settings', async () => {
        const board = new FakeBoard({
            fw: 'tinkerbit',
            files: {
                [STAMP_PATH]: 'fw-test1',
                [CONFIG_PATH]: JSON.stringify(CLOUD_CONFIG)
            }
        });
        const logs = [];
        await upload(board, {onLog: text => logs.push(text)});
        expect(board.files[CONFIG_PATH]).toBeUndefined();
        expect(logs.join('')).toMatch(/Removed the Cloud settings/);
    });

    test('a firmware with another library API is not uploaded to', async () => {
        const older = new FakeBoard({fw: 'tinkerbit', api: FIRMWARE_API - 1, files: {[STAMP_PATH]: 'fw-test1'}});
        const errOld = await failure(upload(older));
        expect(errOld.message).toMatch(/older TinkerBit firmware.*Update board/);
        expect(older.files['/main.py']).toBeUndefined();

        const newer = new FakeBoard({fw: 'tinkerbit', api: FIRMWARE_API + 1, files: {[STAMP_PATH]: 'fw-test1'}});
        const errNew = await failure(upload(newer));
        expect(errNew.message).toMatch(/newer TinkerBit firmware.*Reload the page/);
        expect(newer.files['/main.py']).toBeUndefined();
    });

    test('the Studio expects the API of the library it bundles', () => {
        const initPath = path.join(__dirname, '../../../prototypes/micropython/lib/tinkerbit/__init__.py');
        expect(Number(/^API = (\d+)$/m.exec(fs.readFileSync(initPath, 'utf8'))[1])).toBe(FIRMWARE_API);
    });

    test('the bundled firmware file is the one the Studio checks for', () => {
        const bin = fs.readFileSync(path.join(__dirname, '../../..', FIRMWARE_URL));
        expect(createHash('sha256')
            .update(bin)
            .digest('hex')).toBe(FIRMWARE_SHA256);
        expect(firmwareImages(new Uint8Array(bin)).map(i => i.address)).toEqual([0x1000, 0xe000, 0x10000]);
    });
});

describe('Update board installs MicroPython; Upload never does', () => {
    const binPath = path.join(__dirname, '../../..', FIRMWARE_URL);
    const serve = bytes => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))
        }));
    };
    const updateBoard = async (board, logs = []) => {
        await installFirmware(board, null, text => logs.push(text));
        return installLibrary({port: board, library, onLog: text => logs.push(text)});
    };

    beforeEach(() => {
        forgetBundledFirmware();
        flashEspImagesOnPort.mockReset();
        flashEspImagesOnPort.mockImplementation(port => {
            port.installMicroPython();
            return Promise.resolve();
        });
        serve(fs.readFileSync(binPath));
    });

    afterEach(() => {
        delete global.fetch;
    });

    test('a MicroPython board with the library only gets main.py', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-test1'}});
        const logs = [];
        const result = await upload(board, {onLog: text => logs.push(text)});
        expect(result.libraryInstalled).toBe(false);
        expect(flashEspImagesOnPort).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(logs.join(''))
            .toMatch(/Board: MicroPython 1\.24\.1 on Generic ESP32 module with ESP32, library studio-test1/);
    });

    test('Upload on an Arduino board points to Update board and flashes nothing', async () => {
        const board = new FakeBoard({micropython: false});
        const err = await failure(upload(board));
        expect(err).toBeInstanceOf(NoMicroPythonError);
        expect(err.message).toMatch(/Update board/);
        expect(flashEspImagesOnPort).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        const friendly = friendlyUpload({phase: 'error', message: err.message, connected: true, supported: true});
        expect(friendly.text).toBe('This board needs MicroPython first.');
        expect(friendly.tip).toMatch(/Update board/);
    }, 15000);

    test('checking a MicroPython board reports it and starts its program again', async () => {
        const board = new FakeBoard({files: {[STAMP_PATH]: 'studio-test1', '/main.py': 'print(1)\n'}});
        const info = await checkBoard({port: board});
        expect(info).toEqual(stockInfo(board, 'studio-test1'));
        expect(board.mode).toBe('running');
        expect(board.files['/main.py']).toBe('print(1)\n');
    });

    test('checking an Arduino or silent board reports it without changing anything', async () => {
        expect(await checkBoard({port: new FakeBoard({micropython: false})})).toEqual({lang: 'arduino'});
        expect(await checkBoard({port: new FakeBoard({micropython: false, rom: false})})).toEqual({lang: 'unknown'});
        expect(flashEspImagesOnPort).not.toHaveBeenCalled();
    }, 20000);

    test('Update board flashes the TinkerBit firmware, then boot.py, and no program', async () => {
        const board = new FakeBoard({micropython: false});
        const info = await updateBoard(board);
        expect(flashEspImagesOnPort).toHaveBeenCalledTimes(1);
        const images = flashEspImagesOnPort.mock.calls[0][1].images;
        expect(images.map(i => i.address)).toEqual([0x1000, 0xe000, 0x10000]);
        expect(info).toEqual(firmwareInfo(board, 'fw-test1'));
        expect(board.files[STAMP_PATH]).toBe('fw-test1');
        expect(board.files['/boot.py']).toBe('import tinkerbit\n');
        expect(board.files['/lib/tinkerbit/__init__.py']).toBeUndefined();
        expect(board.files['/main.py']).toBeUndefined();
    }, 20000);

    test('Update board on a MicroPython board removes the old program, Cloud settings and library copy', async () => {
        const board = new FakeBoard({files: {
            [STAMP_PATH]: 'studio-test1',
            '/main.py': 'print(1)\n',
            [CONFIG_PATH]: JSON.stringify(CLOUD_CONFIG),
            '/lib/tinkerbit/__init__.py': 'old',
            '/lib/tinkerbit/board.py': 'old pins',
            '/lib/ssd1306.py': 'old'
        }});
        const logs = [];
        await updateBoard(board, logs);
        expect(Object.keys(board.files).sort()).toEqual(['/boot.py', STAMP_PATH]);
        expect(logs.join('')).toMatch(/Removed the old program/);
        expect(logs.join('')).not.toContain(CLOUD_CONFIG.wifi_password);
    }, 20000);

    test('a board with another chip is refused by the check', async () => {
        const board = new FakeBoard({machine: 'Generic ESP32S3 module with ESP32S3'});
        const err = await failure(checkBoard({port: board}));
        expect(err.message).toMatch(/not the TinkerBit ESP32/);
    });

    test('a damaged firmware download is not flashed', async () => {
        const bytes = fs.readFileSync(binPath);
        bytes[0x20000] ^= 0xff;
        serve(bytes);
        const err = await failure(updateBoard(new FakeBoard({micropython: false})));
        expect(err.message).toMatch(/damaged/);
        expect(flashEspImagesOnPort).not.toHaveBeenCalled();
    }, 20000);

    test('MicroPython that does not start after flashing says so', async () => {
        flashEspImagesOnPort.mockImplementation(() => Promise.resolve());
        const err = await failure(updateBoard(new FakeBoard({micropython: false})));
        expect(err.message).toMatch(/did not start after installing/);
    }, 40000);
});

describe('MicroPython firmware file', () => {
    const fakeBin = () => {
        const bin = new Uint8Array(0x20000).fill(0xff);
        bin[0] = 0xe9;
        bin[12] = 0;
        bin[13] = 0;
        bin[0x7000] = 0xaa;
        bin[0x7001] = 0x50;
        bin[0xf000] = 0xe9;
        bin[0xf00c] = 0;
        bin[0xf00d] = 0;
        return bin;
    };
    const bytesOf = image => Buffer.from(image.data, 'base64');

    test('is split at 0x1000, 0xe000 and 0x10000 with every byte kept', () => {
        const bin = fakeBin();
        const images = firmwareImages(bin);
        expect(images.map(i => i.address)).toEqual([0x1000, 0xe000, 0x10000]);
        const joined = Buffer.concat(images.map(bytesOf));
        expect(joined.equals(Buffer.from(bin))).toBe(true);
        expect(bytesOf(images[2])[0]).toBe(0xe9);
    });

    test('anything else is refused with a reason', () => {
        expect(() => firmwareImages(new Uint8Array(100))).toThrow(/not a MicroPython firmware/);
        const noTable = fakeBin();
        noTable[0x7000] = 0xff;
        expect(() => firmwareImages(noTable)).toThrow(/partition table/);
        const s3 = fakeBin();
        s3[0xf00c] = 9;
        expect(() => firmwareImages(s3)).toThrow(/different chip/);
        const s3AtZero = new Uint8Array(0x20000).fill(0xff);
        s3AtZero[0] = 0xe9;
        s3AtZero[12] = 9;
        expect(() => firmwareImages(s3AtZero)).toThrow(/different chip/);
    });
});

describe('raw REPL link', () => {
    test('a Python error comes back as its last line', async () => {
        const board = new FakeBoard();
        board.exec = () => ({
            out: '',
            err: 'Traceback (most recent call last):\r\nNameError: name \'x\' isn\'t defined\r\n'
        });
        const link = new ReplLink(board);
        await link.start();
        await link.enterRaw();
        const err = await failure(link.run('x'));
        expect(err.message).toBe("NameError: name 'x' isn't defined");
        expect(err.traceback).toMatch(/^Traceback/);
        await link.stop();
    });

    test('MicroPython steps and errors read plainly, without the BOOT button advice', () => {
        const at = (phase, message) => friendlyUpload({phase, message, connected: true, supported: true});
        expect(at('uploading', 'Installing the TinkerBit library (1/5)…').text).toMatch(/first time only/);
        expect(at('uploading', 'MicroPython: Writing image 2/3…').text)
            .toMatch(/Putting the TinkerBit firmware on your board/);
        expect(at('uploading', 'Checking your board…').text).toBe('Checking your board…');
        expect(at('error', 'The downloaded TinkerBit firmware is damaged. Reload the page.').text)
            .toMatch(/damaged/);
        expect(at('error', 'This board is not the TinkerBit ESP32 (it reports "ESP32S3").').text)
            .toMatch(/not the TinkerBit ESP32/);
        expect(at('uploading', 'Sending your program…').text).toBe('Sending to your board…');
        const crash = at('error', 'Your program stopped: TinkerBitError: D13 is already used by Led');
        expect(crash.text).toMatch(/D13 is already used/);
        expect(crash.tip).not.toMatch(/BOOT/);
        expect(at('error', 'The board stopped answering. Check the USB cable, then Upload again.').text)
            .not.toMatch(/BOOT/);
        expect(at('error', 'This firmware is for a different chip (for example ESP32-S3).').text)
            .toMatch(/different chip/);
    });

    test('lastLine skips blank lines', () => {
        expect(lastLine('a\r\nb\r\n\r\n')).toBe('b');
        expect(lastLine('')).toBe('');
    });

    test('opening drops RTS before DTR so the board is not reset', async () => {
        const board = new FakeBoard();
        const seen = [];
        const original = board.setSignals.bind(board);
        board.setSignals = s => {
            seen.push(Object.keys(s).join());
            return original(s);
        };
        const link = new ReplLink(board);
        await link.start();
        await link.stop();
        expect(seen).toEqual(['requestToSend', 'dataTerminalReady']);
    });
});
