'use strict';

const http = require('http');
const {execFile} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {promisify} = require('util');

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.COMPILE_PORT || '20113', 10);
const ARDUINO_CLI = process.env.ARDUINO_CLI || '/opt/openblock-link/tools/Arduino/arduino-cli';
const ARDUINO_CONFIG = process.env.ARDUINO_CONFIG || '/opt/openblock-link/tools/Arduino/arduino-cli.yaml';
const ARDUINO_DATA = process.env.ARDUINO_DATA || '/opt/openblock-link/tools/Arduino';
const DEFAULT_ARDUINO_HOME = '/var/lib/compile-api';
const ARDUINO_HOME = process.env.ARDUINO_HOME ||
    (fs.existsSync(DEFAULT_ARDUINO_HOME) ? DEFAULT_ARDUINO_HOME :
        path.join(os.tmpdir(), 'compile-api-home'));
const MAX_SOURCE_BYTES = parseInt(process.env.MAX_SOURCE_BYTES || '131072', 10);
const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || '180000', 10);

const ALLOWED_ORIGINS = new Set([
    'https://basheer.diy',
    'https://www.basheer.diy',
    'https://ide.basheer.diy',
    'https://tingaroo.com',
    'https://www.tingaroo.com',
    'https://blockcode-gui.vercel.app',
    'http://localhost:8601',
    'http://127.0.0.1:8601'
]);

const ALLOWED_FQBN = new Set([
    'arduino:avr:uno',
    'esp32:esp32:esp32',
    'esp32:esp32:esp32s3'
]);

const fqbnBase = fqbn => String(fqbn).split(':').slice(0, 3).join(':');

const isAllowedFqbn = fqbn =>
    ALLOWED_FQBN.has(fqbn) || ALLOWED_FQBN.has(fqbnBase(fqbn));

const isEspFqbn = fqbn => String(fqbn).startsWith('esp32:');

const getBlynkLibraryDirs = () => {
    const candidates = [
        path.join(ARDUINO_HOME, 'Arduino', 'libraries', 'Blynk'),
        path.join(DEFAULT_ARDUINO_HOME, 'Arduino', 'libraries', 'Blynk'),
        '/opt/openblock-link/external-resources/libraries/Blynk'
    ];
    return candidates.filter((dir, index, all) =>
        all.indexOf(dir) === index && fs.existsSync(dir));
};

const detectCompileLibraries = source => {
    if (!source || !source.includes('BlynkSimpleEsp32')) {
        return [];
    }
    return getBlynkLibraryDirs();
};

const setCors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const readBody = req => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_SOURCE_BYTES + 4096) {
            reject(new Error('Payload too large'));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
});

const walkFiles = (dir, acc = []) => {
    if (!fs.existsSync(dir)) return acc;
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    entries.forEach(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(full, acc);
        } else if (entry.isFile()) {
            acc.push(full);
        }
    });
    return acc;
};

const findHexFile = buildDir => {
    const files = walkFiles(buildDir);
    return files.find(full => {
        const name = path.basename(full);
        return name.endsWith('.hex') && !name.includes('bootloader');
    }) || null;
};

const findNamedFile = (buildDir, fileName) =>
    walkFiles(buildDir).find(full => path.basename(full) === fileName) || null;

const parseOffset = offset => {
    const text = String(offset).trim();
    if (text.startsWith('0x') || text.startsWith('0X')) {
        return parseInt(text, 16);
    }
    return parseInt(text, 10);
};

const resolveImagePath = (buildDir, rel) => {
    if (!rel) return null;
    if (path.isAbsolute(rel) && fs.existsSync(rel)) return rel;
    const fromBuild = path.join(buildDir, rel);
    if (fs.existsSync(fromBuild)) return fromBuild;
    const nested = findNamedFile(buildDir, path.basename(rel));
    return nested || null;
};

const collectEspImages = buildDir => {
    const argsPath = findNamedFile(buildDir, 'flasher_args.json');
    const images = [];

    if (argsPath) {
        const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'));
        const files = args.flash_files || {};
        Object.keys(files).forEach(offset => {
            const abs = resolveImagePath(path.dirname(argsPath), files[offset]);
            if (!abs) {
                throw new Error(`Missing flash image ${files[offset]} at ${offset}`);
            }
            const buf = fs.readFileSync(abs);
            images.push({
                address: parseOffset(offset),
                name: path.basename(abs),
                size: buf.length,
                data: buf.toString('base64')
            });
        });
        images.sort((a, b) => a.address - b.address);

        // Prefer a real boot_app0.bin for otadata so OTA slot 0 is selected.
        // Erased 0xFF otadata also works, but boot_app0 is what Arduino IDE flashes.
        const hasOtaData = images.some(image => image.address === 0xe000);
        if (!hasOtaData) {
            const pkgRoot = path.join(ARDUINO_DATA, 'packages', 'esp32', 'hardware', 'esp32');
            let bootApp0 = findNamedFile(buildDir, 'boot_app0.bin');
            if (!bootApp0 && fs.existsSync(pkgRoot)) {
                const versions = fs.readdirSync(pkgRoot);
                for (let i = 0; i < versions.length; i++) {
                    const candidate = path.join(
                        pkgRoot, versions[i], 'tools', 'partitions', 'boot_app0.bin'
                    );
                    if (fs.existsSync(candidate)) {
                        bootApp0 = candidate;
                        break;
                    }
                }
            }
            if (bootApp0) {
                const buf = fs.readFileSync(bootApp0);
                images.push({
                    address: 0xe000,
                    name: 'boot_app0.bin',
                    size: buf.length,
                    data: buf.toString('base64')
                });
                images.sort((a, b) => a.address - b.address);
            }
        }

        if (!images.some(image => image.address === 0x10000 ||
            (image.address >= 0x10000 && image.address < 0x150000))) {
            throw new Error('flasher_args.json did not include an app image near 0x10000');
        }

        const settings = args.flash_settings || {};
        return {
            format: 'esptool',
            chip: (args.extra_esptool_args && args.extra_esptool_args.chip) || 'esp32',
            flashMode: settings.flash_mode || 'dio',
            flashFreq: settings.flash_freq || '80m',
            flashSize: settings.flash_size || '4MB',
            images
        };
    }

    // Fallback if flasher_args.json is missing (older cores).
    const app = walkFiles(buildDir).find(full => {
        const name = path.basename(full);
        return name.endsWith('.ino.bin') || name === 'sketch.bin';
    });
    const bootloader = walkFiles(buildDir).find(full => path.basename(full).includes('bootloader') &&
        full.endsWith('.bin'));
    const partitions = walkFiles(buildDir).find(full => path.basename(full).includes('partitions') &&
        full.endsWith('.bin'));
    const bootApp0 = findNamedFile(buildDir, 'boot_app0.bin');

    if (!app) {
        throw new Error('Compile succeeded but no ESP32 BIN images found.');
    }
    if (bootloader) {
        const buf = fs.readFileSync(bootloader);
        images.push({
            address: 0x1000,
            name: path.basename(bootloader),
            size: buf.length,
            data: buf.toString('base64')
        });
    }
    if (partitions) {
        const buf = fs.readFileSync(partitions);
        images.push({
            address: 0x8000,
            name: path.basename(partitions),
            size: buf.length,
            data: buf.toString('base64')
        });
    }
    if (bootApp0) {
        const buf = fs.readFileSync(bootApp0);
        images.push({
            address: 0xe000,
            name: path.basename(bootApp0),
            size: buf.length,
            data: buf.toString('base64')
        });
    }
    const appBuf = fs.readFileSync(app);
    images.push({
        address: 0x10000,
        name: path.basename(app),
        size: appBuf.length,
        data: appBuf.toString('base64')
    });
    return {
        format: 'esptool',
        chip: 'esp32',
        flashMode: 'dio',
        flashFreq: '80m',
        flashSize: '4MB',
        images
    };
};

const compileSketch = async (source, fqbn) => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-'));
    const sketchDir = path.join(workDir, 'sketch');
    fs.mkdirSync(sketchDir);
    fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), source, 'utf8');
    const buildDir = path.join(workDir, 'build');
    const userDir = path.join(ARDUINO_HOME, 'Arduino');
    fs.mkdirSync(userDir, {recursive: true});
    const libraryDirs = detectCompileLibraries(source);
    const compileArgs = [
        '--config-file', ARDUINO_CONFIG,
        'compile',
        '-b', fqbn,
        '--build-path', buildDir
    ];
    libraryDirs.forEach(dir => {
        compileArgs.push('--library', dir);
    });
    compileArgs.push(sketchDir);

    try {
        const {stdout, stderr} = await execFileAsync(
            ARDUINO_CLI,
            compileArgs,
            {
                timeout: COMPILE_TIMEOUT_MS,
                maxBuffer: 8 * 1024 * 1024,
                env: Object.assign({}, process.env, {
                    HOME: ARDUINO_HOME,
                    ARDUINO_DIRECTORIES_DATA: ARDUINO_DATA,
                    ARDUINO_DIRECTORIES_DOWNLOADS: path.join(ARDUINO_DATA, 'staging'),
                    ARDUINO_DIRECTORIES_USER: userDir
                })
            }
        );
        const log = [stdout, stderr].filter(Boolean).join('\n');
        if (isEspFqbn(fqbn)) {
            return Object.assign({log}, collectEspImages(buildDir));
        }
        const hexPath = findHexFile(buildDir);
        if (!hexPath) {
            throw new Error(`Compile succeeded but no HEX found.\n${log}`);
        }
        return {
            hex: fs.readFileSync(hexPath, 'utf8'),
            log
        };
    } finally {
        fs.rmSync(workDir, {recursive: true, force: true});
    }
};

const sendJson = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
    setCors(req, res);

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/api/compile/health') {
        sendJson(res, 200, {ok: true});
        return;
    }

    if (req.method !== 'POST' || req.url !== '/api/compile') {
        sendJson(res, 404, {error: 'Not found'});
        return;
    }

    try {
        const raw = await readBody(req);
        const body = JSON.parse(raw);
        const fqbn = body.fqbn || 'arduino:avr:uno';
        const source = body.source;

        if (!source || typeof source !== 'string') {
            sendJson(res, 400, {error: 'Missing source string'});
            return;
        }
        if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
            sendJson(res, 413, {error: 'Source too large'});
            return;
        }
        if (!isAllowedFqbn(fqbn)) {
            sendJson(res, 400, {error: `Unsupported fqbn: ${fqbn}`});
            return;
        }

        const result = await compileSketch(source, fqbn);
        sendJson(res, 200, result);
    } catch (err) {
        sendJson(res, 500, {
            error: err.message || 'Compile failed',
            log: err.stderr || err.stdout || ''
        });
    }
});

server.listen(PORT, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(`Compile API listening on 127.0.0.1:${PORT}`);
});
