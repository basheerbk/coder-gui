/**
 * MicroPython raw REPL over a Web Serial port the Studio already opened (115200 baud).
 * Ported from the prototype test page (prototypes/micropython/index.html), where each step was
 * checked on a CH340 board: plain raw REPL with no pause between chunks is the fastest way to
 * send code, and Ctrl-D in the raw REPL skips main.py, so programs start from the friendly REPL.
 */
const RAW_BANNER = 'raw REPL; CTRL-B to exit\r\n>';
// Each command is compiled on the board in its ~100 KB heap: keep file chunks small.
const CHUNK_BYTES = 2048;
// ESP32 + MicroPython takes about 1 s from reset to boot.py; the TB_SAFE burst must outlast it.
const RECOVER_MS = 2500;

class TimeoutError extends Error {}

const encoder = new TextEncoder();
const toBytes = data => (typeof data === 'string' ? encoder.encode(data) : data);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const indexOf = (hay, needle, from = 0) => {
    for (let i = from; i <= hay.length - needle.length; i++) {
        let j = 0;
        while (j < needle.length && hay[i + j] === needle[j]) {
            j++;
        }
        if (j === needle.length) {
            return i;
        }
    }
    return -1;
};

// One character per byte: boot noise at the wrong baud rate must not throw.
const byteText = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
        text += String.fromCharCode(bytes[i]);
    }
    return text;
};

const toBase64 = bytes => btoa(byteText(bytes));

// Last non-empty line of a traceback ("TinkerBitError: ...").
const lastLine = text => {
    const lines = String(text).trim()
        .split(/\r?\n/)
        .filter(Boolean);
    return lines.length ? lines[lines.length - 1] : '';
};

class ReplLink {
    /**
     * @param {SerialPort} port open Web Serial port
     * @param {object} [options] {isAborted: () => boolean}
     */
    constructor (port, options = {}) {
        this.port = port;
        this.isAborted = options.isAborted || (() => false);
        this.buf = new Uint8Array(0);
        this.waiters = [];
        this.reader = null;
        this.lost = null;
        this.readDone = null;
        this.bootLog = '';
    }

    async start () {
        // Drop RTS first: RTS high with DTR low pulls EN low, which resets the ESP32.
        await this.signals({requestToSend: false});
        await this.signals({dataTerminalReady: false});
        this.reader = this.port.readable.getReader();
        this.readDone = this.readLoop();
    }

    async stop () {
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                // already closed
            }
        }
        await this.readDone;
    }

    async signals (s) {
        try {
            await this.port.setSignals(s);
        } catch (e) {
            // Some USB-serial drivers ignore setSignals.
        }
    }

    async readLoop () {
        try {
            for (;;) {
                const {value, done} = await this.reader.read();
                if (done) {
                    break;
                }
                if (value && value.length) {
                    this.push(value);
                }
            }
        } catch (e) {
            this.lost = e;
        } finally {
            try {
                this.reader.releaseLock();
            } catch (e) {
                // ignore
            }
            this.reader = null;
            this.wake();
        }
    }

    push (chunk) {
        const merged = new Uint8Array(this.buf.length + chunk.length);
        merged.set(this.buf);
        merged.set(chunk, this.buf.length);
        this.buf = merged.length > 262144 ? merged.slice(merged.length - 262144) : merged;
        this.wake();
    }

    wake () {
        const waiting = this.waiters;
        this.waiters = [];
        waiting.forEach(resolve => resolve());
    }

    async write (data) {
        const writer = this.port.writable.getWriter();
        try {
            await writer.write(toBytes(data));
        } finally {
            writer.releaseLock();
        }
    }

    clear () {
        this.buf = new Uint8Array(0);
    }

    has (token) {
        return indexOf(this.buf, toBytes(token)) >= 0;
    }

    async waitFor (find, ms, what) {
        const end = Date.now() + ms;
        for (;;) {
            if (this.isAborted()) {
                throw new Error('Upload cancelled.');
            }
            const found = find(this.buf);
            if (found >= 0) {
                return found;
            }
            if (this.lost || !this.reader) {
                throw new Error('The board stopped answering. Check the USB cable, then Upload again.');
            }
            const left = end - Date.now();
            if (left <= 0) {
                throw new TimeoutError(`Timed out waiting for ${what}`);
            }
            await new Promise(resolve => {
                this.waiters.push(resolve);
                setTimeout(resolve, Math.min(left, 200));
            });
        }
    }

    async readUntil (token, ms = 3000) {
        const t = toBytes(token);
        const i = await this.waitFor(buf => indexOf(buf, t), ms, JSON.stringify(String(token)));
        const out = this.buf.slice(0, i + t.length);
        this.buf = this.buf.slice(i + t.length);
        return out;
    }

    async interrupt () {
        await this.write('\r\x03');
        await sleep(60);
        await this.write('\x03');
        await sleep(60);
        await this.write('\x03');
        await sleep(60);
    }

    async enterRaw (ms = 2000) {
        await this.interrupt();
        this.clear();
        await this.write('\x01');
        await this.readUntil(RAW_BANNER, ms);
    }

    // Keep trying to reach the raw REPL for up to `ms` (a fresh firmware formats its disk first).
    async tryEnterRaw (ms) {
        const end = Date.now() + ms;
        do {
            try {
                await this.enterRaw(Math.min(2000, Math.max(500, end - Date.now())));
                return true;
            } catch (e) {
                if (!(e instanceof TimeoutError)) {
                    throw e;
                }
            }
        } while (Date.now() < end);
        return false;
    }

    async send (code) {
        const data = toBytes(code);
        for (let i = 0; i < data.length; i += 256) {
            await this.write(data.subarray(i, i + 256));
        }
        await this.write('\x04');
        await this.readUntil('OK', 5000);
    }

    // One \x04-terminated frame of the raw REPL's answer.
    async frame (ms) {
        const i = await this.waitFor(buf => indexOf(buf, [4]), ms, 'the board to finish');
        const text = new TextDecoder().decode(this.buf.slice(0, i));
        this.buf = this.buf.slice(i + 1);
        return text;
    }

    async exec (code, timeout = 15000) {
        await this.send(code);
        const out = await this.frame(timeout);
        const err = await this.frame(5000);
        await this.readUntil('>', 2000);
        return {out, err};
    }

    async run (code, timeout) {
        const {out, err} = await this.exec(code, timeout);
        if (err) {
            const e = new Error(lastLine(err));
            e.traceback = err;
            throw e;
        }
        return out;
    }

    // Write a file through a .tmp name, so a cut cable never leaves half a file.
    async writeFile (path, data) {
        const tmp = `${path}.tmp`;
        const parts = path.split('/').filter(Boolean);
        let head = 'import os\nfrom binascii import a2b_base64 as _tb_d\n';
        for (let k = 1; k < parts.length; k++) {
            head += `try:\n os.mkdir(${JSON.stringify(`/${parts.slice(0, k).join('/')}`)})\nexcept OSError:\n pass\n`;
        }
        head += `_tb_f=open(${JSON.stringify(tmp)},'wb')\n`;
        const tail = `_tb_f.close()\ndel _tb_f\ntry:\n os.remove(${JSON.stringify(path)})\nexcept OSError:\n pass\n` +
            `os.rename(${JSON.stringify(tmp)},${JSON.stringify(path)})\n`;
        let cmd = head;
        let raw = 0;
        for (let i = 0; i < data.length; i += 1024) {
            if (raw >= CHUNK_BYTES) {
                await this.run(cmd);
                cmd = '';
                raw = 0;
            }
            cmd += `_tb_f.write(_tb_d('${toBase64(data.subarray(i, i + 1024))}'))\n`;
            raw += 1024;
        }
        await this.run(cmd + tail);
    }

    async hardReset () {
        await this.signals({dataTerminalReady: false, requestToSend: true});
        await sleep(100);
        await this.signals({requestToSend: false});
    }

    // Hard reset, then repeat TB_SAFE until boot.py answers: main.py is skipped.
    // bootLog keeps what the board printed after the reset (the ESP32 ROM prints at 115200).
    async recover (ms = RECOVER_MS) {
        this.clear();
        this.bootLog = '';
        await this.hardReset();
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (this.isAborted()) {
                throw new Error('Upload cancelled.');
            }
            await this.write('TB_SAFE\n');
            await sleep(50);
            if (this.has('TB_SAFE_OK')) {
                this.bootLog = byteText(this.buf);
                await sleep(200);
                return this.tryEnterRaw(3000);
            }
        }
        this.bootLog = byteText(this.buf);
        return false;
    }

    // Leave the raw REPL and soft-reset from the friendly one, so boot.py then main.py run.
    async softResetRunMain () {
        await this.write('\x02');
        await this.readUntil('>>> ', 3000);
        this.clear();
        await this.write('\x04');
        await this.readUntil('MPY: soft reboot\r\n', 3000);
    }

    // What the board printed since the last clear(), as text.
    received () {
        return new TextDecoder().decode(this.buf);
    }

    // The error line if the program crashed within `ms`, else ''.
    async errorWithin (ms) {
        try {
            await this.waitFor(buf => indexOf(buf, toBytes('>>> ')), ms, 'the program');
        } catch (e) {
            if (e instanceof TimeoutError) {
                return '';
            }
            throw e;
        }
        const text = new TextDecoder().decode(this.buf);
        const match = /Traceback[\s\S]*?\n([^\n]*(?:Error|Exception)[^\n]*)/.exec(text);
        return match ? match[1].trim() : '';
    }
}

export {RAW_BANNER, ReplLink, TimeoutError, lastLine};
