let support = null;

/**
 * True when the browser can give us a hardware WebGL2 context (three.js needs WebGL2).
 * Software rasterisers report a "major performance caveat" and count as unsupported.
 */
const hasWebGL2 = () => {
    if (support !== null) {
        return support;
    }
    support = false;
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2', {failIfMajorPerformanceCaveat: true});
        if (gl) {
            support = true;
            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose) {
                lose.loseContext();
            }
        }
    } catch (e) {
        support = false;
    }
    return support;
};

/** ?3d=css or ?3d=gl forces a renderer (support and debugging). */
const forcedRenderer = () => {
    try {
        const value = new URLSearchParams(window.location.search).get('3d');
        return value === 'css' || value === 'gl' ? value : null;
    } catch (e) {
        return null;
    }
};

const warn = (message, err) => {
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[3d] ${message}`, err && err.message ? err.message : err);
    }
};

export {hasWebGL2, forcedRenderer, warn};
