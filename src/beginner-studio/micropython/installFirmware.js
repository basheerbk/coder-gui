import {flashEspImagesOnPort} from '../../lib/web-serial/esptool-flash';

// TinkerBit firmware (Stage B): MicroPython v1.24.1 for ESP32_GENERIC with the tinkerbit library,
// TB_SAFE in _boot.py and the tbcloud module built in (prototypes/micropython/firmware).
const FIRMWARE_URL = '/static/firmware/tinkerbit-esp32-v1.24.1.bin';
const FIRMWARE_NAME = 'TinkerBit firmware (MicroPython 1.24.1)';
const FIRMWARE_SHA256 = '23236190daa1651be541aed2769e77ddbdd25fa95a97493e8611d6de0ea9a822';

const ESP_IMAGE_MAGIC = 0xE9;
// A MicroPython ESP32 .bin is one image meant for 0x1000: bootloader, then the partition table
// at 0x8000, then the app at 0x10000.
const BIN_BASE = 0x1000;
const PARTITIONS = 0x8000 - BIN_BASE;
const OTA_DATA = 0xe000 - BIN_BASE;
const APP = 0x10000 - BIN_BASE;
// esp_image_header_t.chip_id; 0 is the original ESP32 the TinkerBit board uses.
const CHIP_ID_OFFSET = 12;

let bundled = null;

const toBase64 = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) {
        text += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(text);
};

const toHex = buffer => Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Split a MicroPython .bin into the pieces the Studio flasher writes. The 0xe000 piece is part
 * of the .bin, so the flasher does not erase Arduino's otadata over MicroPython's flash.
 * @param {Uint8Array} bin whole MicroPython firmware file
 * @returns {Array<{address: number, data: string, name: string}>} flash images
 */
const firmwareImages = bin => {
    if (bin.length > CHIP_ID_OFFSET + 1 && bin[0] === ESP_IMAGE_MAGIC &&
        (bin[CHIP_ID_OFFSET] !== 0 || bin[CHIP_ID_OFFSET + 1] !== 0)) {
        throw new Error('This MicroPython firmware is for a different chip (for example ESP32-S3).');
    }
    if (bin.length <= APP || bin[0] !== ESP_IMAGE_MAGIC || bin[APP] !== ESP_IMAGE_MAGIC) {
        throw new Error('This is not a MicroPython firmware file for ESP32.');
    }
    if (bin[PARTITIONS] !== 0xAA || bin[PARTITIONS + 1] !== 0x50) {
        throw new Error('This MicroPython firmware has no partition table at 0x8000.');
    }
    if (bin[APP + CHIP_ID_OFFSET] !== 0 || bin[APP + CHIP_ID_OFFSET + 1] !== 0) {
        throw new Error('This MicroPython firmware is for a different chip (for example ESP32-S3).');
    }
    return [
        {address: BIN_BASE, data: toBase64(bin.subarray(0, OTA_DATA)), name: 'bootloader + partitions'},
        {address: BIN_BASE + OTA_DATA, data: toBase64(bin.subarray(OTA_DATA, APP)), name: 'MicroPython'},
        {address: BIN_BASE + APP, data: toBase64(bin.subarray(APP)), name: 'MicroPython app'}
    ];
};

/**
 * Download the bundled firmware once per session and check it is the file we tested.
 * @returns {Promise<Array<object>>} flash images for flashEspImagesOnPort
 */
const loadBundledFirmware = async () => {
    if (bundled) return bundled;
    let response;
    try {
        response = await fetch(FIRMWARE_URL);
    } catch (e) {
        throw new Error('Could not download the TinkerBit firmware. ' +
            'Check your internet, then press Update board again.');
    }
    if (!response.ok) {
        throw new Error(`Could not download the TinkerBit firmware (HTTP ${response.status}). ` +
            'Reload the page, then press Update board again.');
    }
    const buffer = await response.arrayBuffer();
    const hash = toHex(await crypto.subtle.digest('SHA-256', buffer));
    if (hash !== FIRMWARE_SHA256) {
        throw new Error('The downloaded TinkerBit firmware is damaged. ' +
            'Reload the page, then press Update board again.');
    }
    bundled = firmwareImages(new Uint8Array(buffer));
    return bundled;
};

const forgetBundledFirmware = () => {
    bundled = null;
};

/**
 * Write MicroPython to the board. Closes the port, like every esptool flash.
 * @param {SerialPort} port Web Serial port
 * @param {Function} onProgress (text, percent)
 * @param {Function} onLog (text)
 */
const installFirmware = async (port, onProgress, onLog) => {
    const images = await loadBundledFirmware();
    if (onLog) onLog(`Installing ${FIRMWARE_NAME} on the board\r\n`);
    await flashEspImagesOnPort(port, {images}, onProgress, onLog);
};

export {
    FIRMWARE_NAME,
    FIRMWARE_SHA256,
    FIRMWARE_URL,
    firmwareImages,
    forgetBundledFirmware,
    installFirmware,
    loadBundledFirmware
};
