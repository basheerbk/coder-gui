/**
 * Parse Intel HEX into [{address, data}] segments.
 */
const parseIntelHex = hexText => {
    const memory = new Map();
    let extendedAddress = 0;

    hexText.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line.startsWith(':')) return;
        const byteCount = parseInt(line.substr(1, 2), 16);
        const address = parseInt(line.substr(3, 4), 16);
        const recordType = parseInt(line.substr(7, 2), 16);
        const dataStart = 9;

        if (recordType === 0x00) {
            const base = extendedAddress + address;
            for (let i = 0; i < byteCount; i++) {
                const byte = parseInt(line.substr(dataStart + i * 2, 2), 16);
                memory.set(base + i, byte);
            }
        } else if (recordType === 0x04) {
            extendedAddress = parseInt(line.substr(dataStart, 4), 16) << 16;
        }
    });

    if (memory.size === 0) {
        throw new Error('HEX file is empty or invalid.');
    }

    const addresses = Array.from(memory.keys()).sort((a, b) => a - b);
    const pages = [];
    let pageStart = addresses[0];
    let pageData = [];

    for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        if (i > 0 && addr !== addresses[i - 1] + 1) {
            pages.push({address: pageStart, data: new Uint8Array(pageData)});
            pageStart = addr;
            pageData = [];
        }
        pageData.push(memory.get(addr));
    }
    pages.push({address: pageStart, data: new Uint8Array(pageData)});
    return pages;
};

export {
    parseIntelHex
};
