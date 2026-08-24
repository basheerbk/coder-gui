import {parseIntelHex} from './hex-parser';

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const STK_GET_SYNC = 0x30;
const STK_ENTER_PROGMODE = 0x50;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const STK_LEAVE_PROGMODE = 0x11;
const CRC_EOP = 0x20;

const PAGE_SIZE = 128;
const SIGNATURE = [0x1e, 0x95, 0x0f];

const delay = ms => new Promise(r => setTimeout(r, ms));

class WebSerialWriter {
    constructor (port) {
        this.port = port;
        this.writer = null;
    }

    async open () {
        if (this.port.writable.locked) {
            throw new Error('Serial port writer is locked.');
        }
        this.writer = this.port.writable.getWriter();
    }

    async write (bytes) {
        await this.writer.write(bytes);
    }

    async close () {
        if (this.writer) {
            try {
                this.writer.releaseLock();
            } catch (e) {
                // ignore
            }
            this.writer = null;
        }
    }
}

class WebSerialReader {
    constructor (port) {
        this.port = port;
        this.reader = null;
        this.buffer = [];
        this._waiters = [];
        this._pumping = false;
        this._done = false;
    }

    async open () {
        if (this.port.readable.locked) {
            throw new Error('Serial port reader is locked.');
        }
        this.reader = this.port.readable.getReader();
        this.buffer = [];
        this._done = false;
        this._pumping = true;
        this._pump();
    }

    async _pump () {
        try {
            while (this._pumping && this.reader) {
                const {value, done} = await this.reader.read();
                if (done) {
                    this._done = true;
                    break;
                }
                if (value && value.length) {
                    for (let i = 0; i < value.length; i++) {
                        this.buffer.push(value[i]);
                    }
                }
                this._notify();
            }
        } catch (e) {
            this._done = true;
        }
        this._notify();
    }

    _notify () {
        const waiters = this._waiters;
        this._waiters = [];
        waiters.forEach(fn => fn());
    }

    drain () {
        this.buffer = [];
    }

    async readByte (timeoutMs = 3000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (this.buffer.length > 0) {
                return this.buffer.shift();
            }
            if (this._done) {
                break;
            }
            await new Promise(resolve => {
                this._waiters.push(resolve);
                setTimeout(resolve, Math.min(10, Math.max(0, deadline - Date.now())));
            });
        }
        throw new Error('Serial read timeout');
    }

    async close () {
        this._pumping = false;
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                // ignore
            }
            try {
                this.reader.releaseLock();
            } catch (e) {
                // ignore
            }
            this.reader = null;
        }
        this.buffer = [];
        this._notify();
    }
}

/**
 * Optiboot answers 0x14 0x10. USB-serial chips often emit junk (e.g. 0x86)
 * after reset, so skip bytes until that pair appears.
 */
const waitForInsyncOk = async (reader, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let sawInsync = false;
    const receivedBytes = [];
    
    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        
        try {
            const byte = await reader.readByte(remaining);
            receivedBytes.push(byte);
            
            if (!sawInsync) {
                if (byte === STK_INSYNC) {
                    sawInsync = true;
                }
            } else if (byte === STK_OK) {
                return;
            } else if (byte === STK_INSYNC) {
                sawInsync = true;
            } else {
                sawInsync = false;
            }
        } catch (e) {
            break;
        }
    }
    
    // Log what we actually received for debugging
    const hexBytes = receivedBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
    throw new Error(`Timeout. Received: [${hexBytes}]`);
};

const sendCommand = async (writer, reader, body, readTimeoutMs = 1000) => {
    reader.drain();
    await writer.write(new Uint8Array(body));
    await waitForInsyncOk(reader, readTimeoutMs);
};

const syncBootloader = async (writer, reader, maxAttempts = 32) => {
    const packet = new Uint8Array([STK_GET_SYNC, CRC_EOP]);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            // Clear any stale data
            reader.drain();
            
            // Send sync command
            await writer.write(packet);
            
            // Wait up to 100ms for INSYNC+OK response
            await waitForInsyncOk(reader, 100);
            
            // Success! Send one more to confirm stability
            await writer.write(packet);
            await waitForInsyncOk(reader, 100);
            
            return; // Synced successfully
        } catch (e) {
            // Bootloader not ready yet. Wait 100ms before next attempt.
            // This matches avrdude's retry interval.
            if (attempt < maxAttempts - 1) {
                await delay(100);
            }
        }
    }
    
    throw new Error(`Could not sync with Arduino bootloader after ${maxAttempts} attempts (${maxAttempts * 0.2}s)`);
};

const pulseReset = async port => {
    try {
        // avrdude "arduino" programmer sequence:
        // Set DTR low, RTS low, wait, then raise both.
        await port.setSignals({dataTerminalReady: false, requestToSend: false});
        await delay(250);
        await port.setSignals({dataTerminalReady: true, requestToSend: true});
        await delay(50);
    } catch (e) {
        // Some Windows USB-serial drivers ignore setSignals; open() still resets.
    }
};

const buildPages = hexText => {
    const segments = parseIntelHex(hexText);
    const pages = [];
    segments.forEach(segment => {
        for (let offset = 0; offset < segment.data.length; offset += PAGE_SIZE) {
            const chunk = segment.data.slice(offset, offset + PAGE_SIZE);
            const padded = new Uint8Array(PAGE_SIZE);
            padded.fill(0xff);
            padded.set(chunk);
            pages.push({
                address: segment.address + offset,
                data: padded
            });
        }
    });
    return pages;
};

const flashHexOnPort = async (port, hexText, onProgress) => {
    // Close and reopen to trigger DTR reset - more reliable than setSignals()
    try {
        await port.close();
    } catch (e) {
        // ignore
    }
    await delay(100);
    
    // Opening the port pulses DTR automatically, triggering the reset
    await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 255,
        flowControl: 'none'
    });
    
    const writer = new WebSerialWriter(port);
    const reader = new WebSerialReader(port);
    await writer.open();
    await reader.open();

    try {
        if (onProgress) onProgress('Waiting for bootloader…', 5);
        
        // Wait a moment for bootloader to start after port open
        await delay(50);
        reader.drain();
        
        if (onProgress) onProgress('Syncing with bootloader…', 8);
        
        try {
            // Try 32 times with 100ms between attempts = 3.2 second window
            await syncBootloader(writer, reader, 32);
        } catch (e) {
            // First attempt failed. Try closing/reopening port again.
            if (onProgress) onProgress('Retrying reset…', 9);
            await writer.close();
            await reader.close();
            await port.close();
            await delay(100);
            await port.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                bufferSize: 255,
                flowControl: 'none'
            });
            await writer.open();
            await reader.open();
            await delay(50);
            reader.drain();
            await syncBootloader(writer, reader, 32);
        }

        await sendCommand(writer, reader, [STK_ENTER_PROGMODE, CRC_EOP], 1000);
        if (onProgress) onProgress('Bootloader synced. Writing flash…', 12);

        const pages = buildPages(hexText);
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const wordAddress = Math.floor(page.address / 2);
            const addrLow = wordAddress & 0xff;
            const addrHigh = (wordAddress >> 8) & 0xff;
            await sendCommand(
                writer,
                reader,
                [STK_LOAD_ADDRESS, addrLow, addrHigh, CRC_EOP],
                1000
            );
            const body = [
                STK_PROG_PAGE,
                (PAGE_SIZE >> 8) & 0xff,
                PAGE_SIZE & 0xff,
                0x46,
                ...page.data,
                CRC_EOP
            ];
            await sendCommand(writer, reader, body, 2000);
            if (onProgress) {
                const pct = 10 + Math.round(((i + 1) / pages.length) * 85);
                onProgress(`Flashing page ${i + 1}/${pages.length}…`, pct);
            }
        }

        await sendCommand(writer, reader, [STK_LEAVE_PROGMODE, CRC_EOP], 1000);
        if (onProgress) onProgress('Upload complete.', 100);
    } finally {
        await reader.close();
        await writer.close();
    }
};

export {
    flashHexOnPort,
    SIGNATURE
};
