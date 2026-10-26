#!/usr/bin/env node
/**
 * Generates landing/site assets into .generated/site-assets (copied to the build root by webpack):
 *   static/landing/<slot>.webp + .png  from src/landing/media/<slot>.(png|jpg|jpeg)
 *   static/landing/og-image.png        cropped to 1200x630
 *   favicon.ico, static/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png,
 *   static/brand/logo-512.png           from src/site/brand/logo-mark.svg
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MEDIA_DIR = path.join(ROOT, 'src/landing/media');
const LOGO_SVG = path.join(ROOT, 'src/site/brand/logo-mark.svg');
const OUT_DIR = path.join(ROOT, '.generated/site-assets');
const LANDING_OUT = path.join(OUT_DIR, 'static/landing');

const SLOT_MAX_WIDTH = {
    'hero': 1920,
    'gallery-nightlight': 1200,
    'gallery-doorbell': 1200,
    'gallery-bot': 1200
};
const SOURCE_EXTS = ['.png', '.jpg', '.jpeg'];

const ensureDir = dir => fs.mkdirSync(dir, {recursive: true});

/** Newest source file for a slot, so a dropped-in hero.jpg wins over an older hero.png. */
const findSource = slot => {
    const candidates = SOURCE_EXTS
        .map(ext => path.join(MEDIA_DIR, `${slot}${ext}`))
        .filter(file => fs.existsSync(file));
    if (!candidates.length) {
        return null;
    }
    return candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
};

const buildSlot = async (slot, maxWidth) => {
    const source = findSource(slot);
    if (!source) {
        throw new Error(`Missing landing image: src/landing/media/${slot}.png (or .jpg)`);
    }
    const base = () => sharp(source).rotate()
        .resize({width: maxWidth, withoutEnlargement: true});
    await base().webp({quality: 80})
        .toFile(path.join(LANDING_OUT, `${slot}.webp`));
    const pngOut = path.join(LANDING_OUT, `${slot}.png`);
    const meta = await sharp(source).metadata();
    if (path.extname(source).toLowerCase() === '.png' && meta.width <= maxWidth) {
        fs.copyFileSync(source, pngOut);
        return;
    }
    // Palette PNG keeps the fallback far smaller than truecolor (~10x) for photos.
    await base().png({palette: true, quality: 85, compressionLevel: 9})
        .toFile(pngOut);
};

const buildOgImage = async () => {
    const source = findSource('og-image') || findSource('hero');
    await sharp(source).rotate()
        .resize(1200, 630, {fit: 'cover', position: 'centre'})
        .png({palette: true, quality: 85, compressionLevel: 9})
        .toFile(path.join(LANDING_OUT, 'og-image.png'));
};

/** ICO container holding PNG images (supported by all current browsers). */
const pngsToIco = pngs => {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    const entries = [];
    let offset = 6 + (16 * pngs.length);
    pngs.forEach(({size, data}) => {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size >= 256 ? 0 : size, 0);
        entry.writeUInt8(size >= 256 ? 0 : size, 1);
        entry.writeUInt8(0, 2);
        entry.writeUInt8(0, 3);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += data.length;
        entries.push(entry);
    });
    return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
};

const buildIcons = async () => {
    const rounded = fs.readFileSync(LOGO_SVG, 'utf8');
    // iOS and maskable Android icons get their own corner mask, so they need a full-bleed square.
    const square = rounded.replace(/rx="\d+"/, 'rx="0"');
    const render = (svg, size) => sharp(Buffer.from(svg), {density: 300})
        .resize(size, size)
        .png({compressionLevel: 9})
        .toBuffer();

    ensureDir(path.join(OUT_DIR, 'static/brand'));
    fs.writeFileSync(path.join(OUT_DIR, 'apple-touch-icon.png'), await render(square, 180));
    fs.writeFileSync(path.join(OUT_DIR, 'icon-192.png'), await render(square, 192));
    fs.writeFileSync(path.join(OUT_DIR, 'icon-512.png'), await render(square, 512));
    fs.writeFileSync(path.join(OUT_DIR, 'static/brand/logo-512.png'), await render(rounded, 512));
    fs.copyFileSync(LOGO_SVG, path.join(OUT_DIR, 'static/brand/logo-mark.svg'));

    const icoPngs = await Promise.all([16, 32, 48].map(async size => ({size, data: await render(rounded, size)})));
    const ico = pngsToIco(icoPngs);
    fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), ico);
    fs.writeFileSync(path.join(OUT_DIR, 'static/favicon.ico'), ico);
};

const main = async () => {
    fs.rmSync(OUT_DIR, {recursive: true, force: true});
    ensureDir(LANDING_OUT);
    await Promise.all(Object.keys(SLOT_MAX_WIDTH).map(slot => buildSlot(slot, SLOT_MAX_WIDTH[slot])));
    await buildOgImage();
    await buildIcons();
    console.log(`Site assets written to ${path.relative(ROOT, OUT_DIR)}`);
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
