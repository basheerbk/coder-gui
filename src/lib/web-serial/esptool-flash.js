import {ESPLoader, Transport, ClassicReset, UsbJtagSerialReset} from 'esptool-js';
import CryptoJS from 'crypto-js';

const ESP_IMAGE_MAGIC = 0xe9;
const ROM_BAUD = 115200;
// CP210x (10c4:ea60) often corrupts SLIP above 115200. Stay at ROM baud.
const FLASH_BAUD_RATES = [115200];
const SERIAL_OPTIONS = {
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 65536,
    flowControl: 'none'
};

const base64ToUint8 = b64 => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i) & 0xff;
    }
    return bytes;
};

// Never use TextDecoder here. "latin1" can become windows-1252 and rewrite 0x80-0x9F,
// which keeps length the same so MD5 still passes but the ROM checksum fails.
const uint8ToBstr = bytes => {
    let str = '';
    const chunk = 0x2000;
    for (let i = 0; i < bytes.length; i += chunk) {
        str += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return str;
};

const md5Hex = image => {
    const bytes = typeof image === 'string' ?
        Uint8Array.from(image, ch => ch.charCodeAt(0) & 0xff) :
        image;
    const words = [];
    for (let i = 0; i < bytes.length; i += 4) {
        words.push(
            ((bytes[i] || 0) << 24) |
            ((bytes[i + 1] || 0) << 16) |
            ((bytes[i + 2] || 0) << 8) |
            (bytes[i + 3] || 0)
        );
    }
    const wordArray = CryptoJS.lib.WordArray.create(words, bytes.length);
    return CryptoJS.MD5(wordArray).toString();
};

const toAddress = value => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid flash address: ${value}`);
    }
    return n;
};

const hexAddr = address => `0x${address.toString(16)}`;

const OTA_DATA_OFFSET = 0xe000;
const OTA_DATA_SIZE = 0x2000;

/**
 * Do NOT rewrite flash-mode/freq bytes in app images.
 * ESP32 app binaries include a SHA-256 of the image; changing header bytes
 * without recalculating that hash causes:
 *   "esp_image: Image hash failed - image is corrupt"
 *   "OTA app partition slot 0 is not bootable"
 */
const erasedOtaDataImage = () => {
    const bytes = new Uint8Array(OTA_DATA_SIZE);
    bytes.fill(0xff);
    return {
        address: OTA_DATA_OFFSET,
        data: uint8ToBstr(bytes)
    };
};

const describeFlashHeader = bytes => {
    if (!bytes.length || bytes[0] !== ESP_IMAGE_MAGIC) {
        return '';
    }
    const modes = ['QIO', 'QOUT', 'DIO', 'DOUT'];
    const freqs = {0: '40MHz', 1: '26MHz', 2: '20MHz', 0xf: '80MHz'};
    const mode = modes[bytes[2]] || String(bytes[2]);
    const freq = freqs[bytes[3] & 0x0f] || `freq=${bytes[3] & 0x0f}`;
    return ` ${mode}/${freq}`;
};

const isRecoverableFlashError = err => {
    const msg = String((err && err.message) || err);
    return /invalid head of packet|serial noise|slip|timeout|failed to connect|corrupt|packet content transfer stopped/i.test(msg);
};

const prepareImages = (firmware, onLog) => {
    const images = (firmware.images || []).map((image, index) => {
        const address = toAddress(image.address);
        const bytes = base64ToUint8(image.data);
        if (image.size && bytes.length !== image.size) {
            throw new Error(
                `Flash image at ${hexAddr(address)} was truncated ` +
                `(${bytes.length} of ${image.size} bytes). Try upload again.`
            );
        }
        if (bytes.length === 0) {
            throw new Error(`Flash image ${index + 1} at ${hexAddr(address)} is empty.`);
        }
        // App partitions must keep original header (hash integrity).
        if (address >= 0x10000 && bytes[0] !== ESP_IMAGE_MAGIC) {
            throw new Error(
                `App image at ${hexAddr(address)} is not valid ESP32 firmware ` +
                `(got 0x${bytes[0].toString(16)}).`
            );
        }
        if (onLog) {
            const name = image.name ? ` ${image.name}` : '';
            onLog(`  ${hexAddr(address)}  ${bytes.length} bytes${name}${describeFlashHeader(bytes)}\r\n`);
        }
        return {
            address,
            data: uint8ToBstr(bytes)
        };
    });

    if (!images.some(image => image.address === OTA_DATA_OFFSET)) {
        images.push(erasedOtaDataImage());
        if (onLog) {
            onLog(`  ${hexAddr(OTA_DATA_OFFSET)}  ${OTA_DATA_SIZE} bytes (otadata erased)\r\n`);
        }
    }

    images.sort((a, b) => a.address - b.address);

    if (!images.length) {
        throw new Error('Compile returned no ESP32 flash images.');
    }

    const hasApp = images.some(image => image.address >= 0x10000 && image.address < 0x150000);
    if (!hasApp) {
        throw new Error('Compile returned no app image for OTA slot 0 (0x10000).');
    }

    return images;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const resetOutOfDownloadMode = async transport => {
    try {
        await transport.setDTR(false);
        await transport.setRTS(true);
        await sleep(100);
        await transport.setRTS(false);
        await sleep(50);
        await transport.setDTR(true);
        await sleep(50);
    } catch (e) {
        // Some USB-serial adapters reject extra signal changes.
    }
};

const closeTransport = async (transport, port) => {
    try {
        if (transport && typeof transport.disconnect === 'function') {
            await transport.disconnect();
        }
    } catch (e) {
        // already closed
    }
    try {
        if (port && (port.readable || port.writable)) {
            await port.close();
        }
    } catch (e) {
        // ignore
    }
};

const normalizeFlashFreq = freq => {
    if (!freq) return 'keep';
    const f = String(freq).toLowerCase().replace(/\s/g, '');
    if (f === '40m' || f === '40mhz') return '40m';
    if (f === '80m' || f === '80mhz') return '80m';
    if (f === '26m' || f === '20m') return f;
    return 'keep';
};

const normalizeFlashMode = mode => {
    if (!mode) return 'keep';
    const m = String(mode).toLowerCase();
    if (m === 'dio' || m === 'dout' || m === 'qio' || m === 'qout') return m;
    return 'keep';
};

/**
 * Some laptop USB controllers (especially USB3 hubs / power management) need
 * longer DTR/RTS timing than the esptool-js defaults to enter download mode.
 */
class LaptopClassicReset {
    constructor (transport, resetDelay) {
        this.transport = transport;
        this.resetDelay = resetDelay;
    }

    async reset () {
        await this.transport.setDTR(false);
        await this.transport.setRTS(true);
        await sleep(200);
        await this.transport.setDTR(true);
        await this.transport.setRTS(false);
        await sleep(this.resetDelay);
        await this.transport.setDTR(false);
        await sleep(150);
    }
}

const BOOT_STRATEGIES = [
    {
        id: 'classic',
        label: 'auto-reset',
        mode: 'default_reset',
        resetConstructors: {
            classicReset: (transport, delay) => new ClassicReset(transport, delay),
            usbJTAGSerialReset: transport => new UsbJtagSerialReset(transport)
        }
    },
    {
        id: 'laptop',
        label: 'slow auto-reset (laptop USB)',
        mode: 'default_reset',
        resetConstructors: {
            // Force longer settle times: constructResetSequence uses 50 and 550.
            classicReset: (transport, delay) =>
                new LaptopClassicReset(transport, Math.max(delay || 50, 800)),
            usbJTAGSerialReset: transport => new UsbJtagSerialReset(transport)
        }
    },
    {
        id: 'usb_jtag',
        label: 'USB-JTAG reset',
        mode: 'usb_reset',
        resetConstructors: {
            classicReset: (transport, delay) => new ClassicReset(transport, delay),
            usbJTAGSerialReset: transport => new UsbJtagSerialReset(transport)
        }
    },
    {
        id: 'manual_boot',
        label: 'manual BOOT (hold BOOT on the board)',
        mode: 'default_reset',
        holdBootHint: true,
        resetConstructors: {
            classicReset: (transport, delay) =>
                new LaptopClassicReset(transport, Math.max(delay || 50, 1500)),
            usbJTAGSerialReset: transport => new UsbJtagSerialReset(transport)
        }
    }
];

const ensurePortClosed = async port => {
    try {
        if (port.readable || port.writable) {
            await port.close();
        }
    } catch (e) {
        // already closed
    }
    await sleep(350);
};

const flashOnce = async (port, images, baudRate, firmware, onProgress, onLog, strategy) => {
    const terminal = {
        clean () {},
        writeLine (data) {
            if (onLog) onLog(`${data}\r\n`);
        },
        write (data) {
            if (onLog) onLog(data);
        }
    };

    await ensurePortClosed(port);

    if (strategy.holdBootHint) {
        if (onProgress) onProgress('Hold BOOT on the board now…', 5);
        if (onLog) {
            onLog('>>> HOLD the BOOT button now (some laptops need this)…\r\n');
        }
        await sleep(2000);
    }

    const transport = new Transport(port, false);
    const loader = new ESPLoader({
        transport,
        baudrate: baudRate,
        romBaudrate: ROM_BAUD,
        serialOptions: SERIAL_OPTIONS,
        terminal,
        debugLogging: false,
        resetConstructors: strategy.resetConstructors
    });

    const flashMode = 'keep';
    const flashFreq = 'keep';
    const flashSize = firmware.flashSize ? String(firmware.flashSize) : 'keep';

    try {
        if (onProgress) onProgress(`Bootloader: ${strategy.label}…`, 6);
        if (onLog) onLog(`Connecting (${strategy.label})…\r\n`);

        const connectTimeoutMs = strategy.holdBootHint ? 60000 : 35000;
        const chip = await Promise.race([
            loader.main(strategy.mode),
            sleep(connectTimeoutMs).then(() => {
                throw new Error(
                    `Timed out with ${strategy.label}. ` +
                    'On some laptops hold BOOT during Upload, use a USB2 port, or try another cable.'
                );
            })
        ]);

        if (strategy.holdBootHint && onLog) {
            onLog('Connected — you can release BOOT.\r\n');
        }
        if (onLog) {
            onLog(`Connected to ${chip}\r\n`);
            onLog(
                `Writing unmodified images (mode=${normalizeFlashMode(firmware.flashMode) || 'from binary'}, ` +
                `freq=${normalizeFlashFreq(firmware.flashFreq) || 'from binary'})\r\n`
            );
        }
        if (onProgress) onProgress(`Flashing ${chip}…`, 12);

        const totals = images.map(image => image.data.length);
        const totalBytes = totals.reduce((sum, n) => sum + n, 0) || 1;

        await loader.writeFlash({
            fileArray: images,
            flashSize,
            flashMode,
            flashFreq,
            eraseAll: false,
            compress: true,
            reportProgress: (fileIndex, written, total) => {
                let done = 0;
                for (let i = 0; i < fileIndex; i++) {
                    done += totals[i];
                }
                done += written;
                const pct = 12 + Math.round((done / (total || totalBytes)) * 85);
                if (onProgress) {
                    onProgress(
                        `Writing image ${fileIndex + 1}/${images.length}…`,
                        Math.min(pct, 97)
                    );
                }
            },
            calculateMD5Hash: md5Hex
        });

        if (typeof loader.after === 'function') {
            await loader.after();
        }
        await resetOutOfDownloadMode(transport);
        if (onProgress) onProgress('Upload complete.', 100);
        if (onLog) onLog('Flash OK. Hard-reset the board if it still loops.\r\n');
    } finally {
        await closeTransport(transport, port);
    }
};

const flashEspImagesOnPort = async (port, firmware, onProgress, onLog) => {
    if (onLog) onLog('Flash map:\r\n');
    const images = prepareImages(firmware, onLog);

    let lastError = null;
    for (let s = 0; s < BOOT_STRATEGIES.length; s++) {
        const strategy = BOOT_STRATEGIES[s];
        for (let i = 0; i < FLASH_BAUD_RATES.length; i++) {
            const baudRate = FLASH_BAUD_RATES[i];
            if (onLog) {
                onLog(
                    `Flash attempt ${s + 1}/${BOOT_STRATEGIES.length}: ` +
                    `${strategy.label} @ ${baudRate}\r\n`
                );
            }
            if (onProgress) {
                onProgress(`Opening bootloader (${strategy.label})…`, 5);
            }
            try {
                await flashOnce(
                    port, images, baudRate, firmware, onProgress, onLog, strategy
                );
                return;
            } catch (err) {
                lastError = err;
                if (onLog) onLog(`${err.message}\r\n`);
                const msg = String((err && err.message) || err);
                const canRetry = isRecoverableFlashError(err) ||
                    /timed out|failed to connect|failed to open serial|wrong boot mode/i.test(msg);
                if (!canRetry) {
                    throw err;
                }
                await sleep(500);
            }
        }
    }
    throw new Error(
        'Could not enter ESP32 download mode on this USB port. ' +
        'Close other serial apps, try a USB2 port or different cable, then Upload while holding BOOT.'
    );
};

export {
    flashEspImagesOnPort
};
