import {BOARD} from '../../../domain/ports';

/** Camera presets and limits shared by the CSS and WebGL 3D views. */
const VIEWS = {
    v3d: {rx: 56, rz: -26, label: '3D'},
    vtop: {rx: 0, rz: 0, label: 'Top'},
    vside: {rx: 76, rz: -8, label: 'Edge'}
};
const VIEW_KEYS = ['v3d', 'vtop', 'vside'];
const ZMIN = 0.5;
const ZMAX = 4;
const MAX_TILT = 82;
const CENTER = {x: BOARD.x + (BOARD.w / 2), y: BOARD.y + (BOARD.h / 2)};
/** World units that fill the stage at 100% zoom. */
const FIT = {w: 780, h: 560};
const IDLE_MS = 3500;
/** Viewer distance in world units (the CSS view's perspective). */
const PERSPECTIVE = 2600;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const prefersReducedMotion = () => Boolean(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

/** Pixels per world unit for a stage of w × h at a zoom factor. */
const unitScale = (w, h, zoom) => Math.max(0.25, Math.min(w / FIT.w, h / FIT.h)) * zoom;

export {VIEWS, VIEW_KEYS, ZMIN, ZMAX, MAX_TILT, CENTER, FIT, IDLE_MS, PERSPECTIVE, clamp, prefersReducedMotion, unitScale};
