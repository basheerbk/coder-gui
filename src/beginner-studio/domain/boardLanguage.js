/**
 * Which language the Studio writes for the board. MicroPython is the default; ?board=arduino
 * switches this browser to Arduino (remembered) and ?board=micropython switches it back.
 */
const STORAGE_KEY = 'tb.boardLanguage';
const ARDUINO = 'arduino';
const MICROPYTHON = 'micropython';

const askedInUrl = search => {
    try {
        const query = typeof search === 'string' ? search : window.location.search;
        const match = /(?:^|[?&])board=([^&#]*)/.exec(query || '');
        const asked = match ? decodeURIComponent(match[1]) : null;
        return asked === ARDUINO || asked === MICROPYTHON ? asked : null;
    } catch (e) {
        return null;
    }
};

/**
 * @param {string} [search] query string (default: the page's)
 * @param {Storage} [storage] where the choice is remembered (default: localStorage)
 * @returns {string} ARDUINO or MICROPYTHON
 */
const readBoardLanguage = (search, storage) => {
    const asked = askedInUrl(search);
    try {
        const store = storage || window.localStorage;
        if (asked) {
            store.setItem(STORAGE_KEY, asked);
            return asked;
        }
        return store.getItem(STORAGE_KEY) === ARDUINO ? ARDUINO : MICROPYTHON;
    } catch (e) {
        return asked || MICROPYTHON;
    }
};

export {ARDUINO, MICROPYTHON, readBoardLanguage};
