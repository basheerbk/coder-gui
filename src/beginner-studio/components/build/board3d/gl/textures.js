import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CanvasTexture, SRGBColorSpace} from 'three';

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

/**
 * Textures drawn from React SVG or a 2D-canvas callback, cached by key.
 * SVG textures come back at once (filled with `base`) and fill in when the image decodes;
 * if the browser refuses the SVG or taints the canvas, the texture stays a flat colour.
 */
class TextureBank {
    constructor ({maxSize, anisotropy, onChange}) {
        this.maxEdge = Math.min(MAX_EDGE, maxSize || 2048);
        this.anisotropy = anisotropy || 1;
        this.onChange = onChange || (() => {});
        this.cache = new Map();
        this.disposed = false;
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

    /** React SVG content laid out in a w × h unit box. */
    svg (key, w, h, content, {ppu = 4, base = null, fallback = base} = {}) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const {cw, ch} = this.size(w, h, ppu);
        const canvas = makeCanvas(cw, ch);
        paint(canvas, base);
        const tex = this.wrap(canvas);
        this.cache.set(key, tex);

        const settle = drawn => {
            if (this.disposed) {
                return;
            }
            if (!drawn) {
                const clean = makeCanvas(cw, ch);
                paint(clean, fallback);
                tex.image = clean;
            }
            tex.needsUpdate = true;
            this.onChange();
        };

        let markup;
        try {
            markup = renderToStaticMarkup(
                <svg
                    xmlns={SVG_NS}
                    width={cw}
                    height={ch}
                    viewBox={`0 0 ${w} ${h}`}
                    preserveAspectRatio="none"
                    fontFamily={FONT}
                >
                    {content}
                </svg>
            );
        } catch (e) {
            settle(false);
            return tex;
        }
        const img = new Image();
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
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        return tex;
    }

    /** Synchronous 2D-canvas texture; draw(ctx, cw, ch) paints in pixels. */
    canvas (key, w, h, draw, {ppu = 8} = {}) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const {cw, ch} = this.size(w, h, ppu);
        const canvas = makeCanvas(cw, ch);
        draw(canvas.getContext('2d'), cw, ch);
        const tex = this.wrap(canvas);
        this.cache.set(key, tex);
        return tex;
    }

    /** Drop textures whose key starts with prefix (e.g. after a theme change); returns them. */
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
    }
}

export default TextureBank;
