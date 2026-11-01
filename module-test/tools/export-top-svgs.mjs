/*
 * Writes a vector top view of every component to module-test/top-svg/:
 *   node module-test/tools/export-top-svgs.mjs
 * <id>.svg on its own, <id>-plugged.svg in its default board jack, esp32-board-light.svg,
 * and index.html to browse them.
 */
import fs from 'fs';
import {register} from 'module';
import {fileURLToPath} from 'url';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('top-svg/', ROOT);
const THREE = new URL('vendor/three/three.module.js', ROOT);

// "three" comes from the vendored copy; the kit's .js files are ES modules
register(`data:text/javascript,${encodeURIComponent(`
const THREE = ${JSON.stringify(THREE.href)};
const ROOT = ${JSON.stringify(ROOT.href)};
export async function resolve (specifier, context, next) {
    if (specifier === 'three') {
        return {url: THREE, format: 'module', shortCircuit: true};
    }
    const result = await next(specifier, context);
    return result.url.startsWith(ROOT) && result.url.endsWith('.js') ? {...result, format: 'module'} : result;
}`)}`);

const {COMPONENTS, toTopSVG} = await import('../lib/index.js');

const embedAsset = asset => fs.readFileSync(new URL(asset.file, ROOT), 'utf8');
fs.mkdirSync(OUT, {recursive: true});

const written = [];
const write = (name, id, options) => {
    const svg = toTopSVG(id, {embedAsset, idPrefix: `${name}-`, ...options});
    fs.writeFileSync(new URL(`${name}.svg`, OUT), svg);
    written.push({name, label: `${COMPONENTS.find(c => c.id === id).name}${options.plugged ? ' (plugged in)' : ''}` +
        `${options.theme === 'light' ? ' (light)' : ''}`, kb: Math.round(svg.length / 1024)});
};

COMPONENTS.forEach(c => {
    write(c.id, c.id, {});
    if (c.kind === 'board') {
        write(`${c.id}-light`, c.id, {theme: 'light'});
    } else {
        write(`${c.id}-plugged`, c.id, {plugged: true});
    }
});

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.writeFileSync(new URL('index.html', OUT), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TinkerBit components, top view</title>
<style>
    body { margin: 0; padding: 20px; background: #f3f4f6; font-family: "Segoe UI", system-ui, sans-serif; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    figure { margin: 0; background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 10px; }
    figure a { display: grid; place-items: center; height: 200px; }
    img { max-width: 100%; max-height: 200px; }
    figcaption { font-size: 12px; margin-top: 8px; display: flex; justify-content: space-between; color: #4b5563; }
</style>
</head>
<body>
<h1>TinkerBit components, top view (vector SVG)</h1>
<main>
${written.map(w => `<figure><a href="${w.name}.svg"><img src="${w.name}.svg" alt="${esc(w.label)}"></a>` +
    `<figcaption><span>${esc(w.label)}</span><span>${w.name}.svg · ${w.kb} KB</span></figcaption></figure>`).join('\n')}
</main>
</body>
</html>
`);

// eslint-disable-next-line no-console
console.log(`Wrote ${written.length} SVGs to ${fileURLToPath(OUT)}`);
