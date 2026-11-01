/** Bytes of a JS string encoded as UTF-8. */
const utf8Bytes = text => {
    const bytes = [];
    const encoded = unescape(encodeURIComponent(String(text)));
    for (let i = 0; i < encoded.length; i++) {
        bytes.push(encoded.charCodeAt(i));
    }
    return bytes;
};

/**
 * Escape any text as the inside of a C string literal. Non-ASCII and control bytes use
 * 3-digit octal escapes, which (unlike \x) can never swallow a following character.
 */
const cEscape = text => utf8Bytes(text).map(b => {
    if (b === 0x5c) {
        return '\\\\';
    }
    if (b === 0x22) {
        return '\\"';
    }
    if (b === 0x3f) {
        // Avoid accidental trigraphs like ??=
        return '\\?';
    }
    if (b < 0x20 || b > 0x7e) {
        return `\\${b.toString(8).padStart(3, '0')}`;
    }
    return String.fromCharCode(b);
})
    .join('');

export {cEscape, utf8Bytes};
