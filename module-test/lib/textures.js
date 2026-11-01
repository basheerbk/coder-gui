import {CanvasTexture, SRGBColorSpace, Texture} from 'three';

import {TEXTURES} from './board-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** SVG drawn as an image can't use the page's web fonts, so name local ones first. */
const FONT = '"Segoe UI", Inter, system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
const MAX_EDGE = 4096;

const makeCanvas = (w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
};

const paint = (canvas, color) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
};

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Textures from SVG markup, SVG/PNG files or a 2D-canvas callback, cached by key.
 * Image textures come back at once (filled with `base`) and fill in when the image decodes;
 * if the browser refuses the image or taints the canvas, the texture stays a flat colour.
 * Every texture keeps its source in userData (svg: {w, h, inner, font}, asset: {name, url, w, h}).
 * A headless bank draws nothing and needs no DOM: enough for toTopSVG and for Node.
 */
class TextureBank {
    constructor ({maxSize, anisotropy, onChange, headless = false} = {}) {
        this.maxEdge = Math.min(MAX_EDGE, maxSize || 2048);
        this.anisotropy = anisotropy || 1;
        this.headless = headless;
        this.listeners = new Set();
        if (onChange) {
            this.listeners.add(onChange);
        }
        this.cache = new Map();
        this.pending = 0;
        this.disposed = false;
    }

    /** Called whenever an async texture finishes; returns an unsubscribe function. */
    onChange (fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    changed () {
        this.listeners.forEach(fn => fn());
    }

    wrap (canvas) {
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = this.anisotropy;
        tex.userData.shared = true;
        return tex;
    }

    size (w, h, ppu) {
        const scale = Math.min(ppu, this.maxEdge / w, this.maxEdge / h);
        return {cw: Math.max(2, Math.round(w * scale)), ch: Math.max(2, Math.round(h * scale))};
    }

    /** Draws an image source (data URL or file URL) into a cached canvas texture. */
    image (key, w, h, src, {ppu = 4, base = null, fallback = base, crossOrigin = false} = {}) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        if (this.headless) {
            const blank = new Texture();
            blank.userData.shared = true;
            this.cache.set(key, blank);
            return blank;
        }
        const {cw, ch} = this.size(w, h, ppu);
        const canvas = makeCanvas(cw, ch);
        paint(canvas, base);
        const tex = this.wrap(canvas);
        this.cache.set(key, tex);
        this.pending += 1;

        const settle = drawn => {
            this.pending -= 1;
            if (this.disposed) {
                return;
            }
            if (!drawn) {
                const clean = makeCanvas(cw, ch);
                paint(clean, fallback);
                tex.image = clean;
            }
            tex.needsUpdate = true;
            this.changed();
        };

        const img = new Image();
        if (crossOrigin) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            if (this.disposed) {
                return;
            }
            try {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, cw, ch);
                if (base) {
                    ctx.fillStyle = base;
                    ctx.fillRect(0, 0, cw, ch);
                }
                ctx.drawImage(img, 0, 0, cw, ch);
                // Throws if the canvas got tainted; a tainted canvas would also fail the GPU upload.
                ctx.getImageData(0, 0, 1, 1);
                settle(true);
            } catch (e) {
                settle(false);
            }
        };
        img.onerror = () => settle(false);
        img.src = src;
        return tex;
    }

    /** SVG markup (the inside of an <svg>) laid out in a w × h unit box. */
    svg (key, w, h, inner, opts = {}) {
        const {cw, ch} = this.size(w, h, opts.ppu || 4);
        const markup = `<svg xmlns="${SVG_NS}" width="${cw}" height="${ch}" viewBox="0 0 ${w} ${h}" ` +
            `preserveAspectRatio="none" font-family="${escapeAttr(FONT)}">${inner}</svg>`;
        const tex = this.image(key, w, h, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, opts);
        tex.userData.svg = {w, h, inner, font: FONT};
        return tex;
    }

    /** One of the exported studio artworks in assets/svg (see board-data.js TEXTURES). */
    asset (name, opts = {}) {
        const info = TEXTURES[name];
        if (!info) {
            throw new Error(`Unknown texture asset: ${name}`);
        }
        const url = new URL(info.file, TextureBank.assetRoot || document.baseURI).href;
        const tex = this.image(`asset:${name}`, info.w, info.h, url, {ppu: info.ppu, base: info.base, ...opts});
        tex.userData.asset = {name, file: info.file, url, w: info.w, h: info.h};
        return tex;
    }

    /**
     * Synchronous 2D-canvas texture; draw(ctx, cw, ch) paints in pixels.
     * svg: the same picture as SVG markup in a w × h box, used by the vector top view.
     */
    canvas (key, w, h, draw, {ppu = 8, svg = null} = {}) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        let tex;
        if (this.headless) {
            tex = new Texture();
            tex.userData.shared = true;
        } else {
            const {cw, ch} = this.size(w, h, ppu);
            const canvas = makeCanvas(cw, ch);
            draw(canvas.getContext('2d'), cw, ch);
            tex = this.wrap(canvas);
        }
        if (svg) {
            tex.userData.svg = {w, h, inner: svg, font: FONT};
        }
        this.cache.set(key, tex);
        return tex;
    }

    /** Drop textures whose key starts with prefix; returns them. */
    evict (prefix) {
        const gone = [];
        Array.from(this.cache.keys()).forEach(key => {
            if (key.indexOf(prefix) === 0) {
                const tex = this.cache.get(key);
                tex.dispose();
                this.cache.delete(key);
                gone.push(tex);
            }
        });
        return gone;
    }

    dispose () {
        this.disposed = true;
        this.cache.forEach(tex => tex.dispose());
        this.cache.clear();
        this.listeners.clear();
    }
}

/** Base URL that asset() resolves files against (lib/index.js points it at module-test/). */
TextureBank.assetRoot = null;

export {FONT};
export default TextureBank;
