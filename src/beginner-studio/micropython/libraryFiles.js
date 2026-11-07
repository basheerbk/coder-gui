/* eslint-disable import/no-unresolved */
// The TinkerBit library lives in prototypes/micropython, where its pytest suite runs.
// Loaded with a dynamic import() so jest and the Arduino path never pull it in.
import tinkerbitInit from '!!raw-loader!../../../prototypes/micropython/lib/tinkerbit/__init__.py';
import tinkerbitBoard from '!!raw-loader!../../../prototypes/micropython/lib/tinkerbit/board.py';
import tinkerbitCloud from '!!raw-loader!../../../prototypes/micropython/lib/tinkerbit/cloud.py';
import ssd1306 from '!!raw-loader!../../../prototypes/micropython/lib/ssd1306.py';
import bootPy from '!!raw-loader!../../../prototypes/micropython/boot.py';
/* eslint-enable import/no-unresolved */

const files = [
    {path: '/lib/tinkerbit/__init__.py', text: tinkerbitInit},
    {path: '/lib/tinkerbit/board.py', text: tinkerbitBoard},
    {path: '/lib/tinkerbit/cloud.py', text: tinkerbitCloud},
    {path: '/lib/ssd1306.py', text: ssd1306},
    {path: '/boot.py', text: bootPy}
];

// FNV-1a over every file: any library change reinstalls it on the next upload.
const fnv1a = texts => {
    let hash = 0x811c9dc5;
    texts.forEach(text => {
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
    });
    return hash.toString(16).padStart(8, '0');
};

// The TinkerBit firmware has the library frozen in; only boot.py (relays off at power-up) is a file.
const firmwareFiles = files.filter(file => file.path === '/boot.py');

const stampOf = (prefix, list) => `${prefix}-${fnv1a(list.map(file => `${file.path}\n${file.text}`))}`;

const library = {
    files,
    stamp: stampOf('studio', files),
    firmwareFiles,
    firmwareStamp: stampOf('fw', firmwareFiles)
};

export default library;
