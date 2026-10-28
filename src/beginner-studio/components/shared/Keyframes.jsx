import React, {useEffect} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const CSS = `
@keyframes tbSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes tbFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes tbWiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
@keyframes tbCableDrop { from { opacity: 0; stroke-dashoffset: 40; } to { opacity: 1; stroke-dashoffset: 0; } }
@keyframes tbDotBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes tbPulseRing { 0% { opacity: 0.9; r: 10; } 100% { opacity: 0; r: 22; } }
@keyframes tbPortPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
@keyframes tbTrace { from { stroke-dashoffset: 12; } to { stroke-dashoffset: -100; } }
@keyframes tbBeat { 0%,100% { opacity: 0.2; } 10% { opacity: 1; } 20% { opacity: 0.3; } 30% { opacity: 0.8; } 45% { opacity: 0.2; } }
@keyframes tb3dGlow { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
.tb3d-stage { position: relative; overflow: hidden; flex: 1; min-width: 0; cursor: grab; touch-action: none; user-select: none; }
.tb3d-stage.tb3d-drag { cursor: grabbing; }
.tb3d-scene { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
.tb3d-group { position: absolute; left: calc(var(--gx) * var(--u)); top: calc(var(--gy) * var(--u)); transform-style: preserve-3d; }
.tb3d-box {
  position: absolute;
  left: calc(var(--x) * var(--u)); top: calc(var(--y) * var(--u));
  width: calc(var(--w) * var(--u)); height: calc(var(--d) * var(--u));
  transform-style: preserve-3d;
  transform: translateZ(calc(var(--z) * var(--u)));
}
.tb3d-f { position: absolute; backface-visibility: hidden; overflow: visible; }
.tb3d-f > svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tb3d-f.t { left: 0; top: 0; right: 0; bottom: 0; transform: translateZ(calc(var(--h) * var(--u))); }
.tb3d-f.s { left: 0; width: 100%; height: calc(var(--h) * var(--u)); top: calc(100% - var(--h) * var(--u)); transform-origin: bottom; transform: rotateX(-90deg); }
.tb3d-f.n { left: 0; width: 100%; top: 0; height: calc(var(--h) * var(--u)); transform-origin: top; transform: rotateX(90deg); }
.tb3d-f.e { top: 0; height: 100%; width: calc(var(--h) * var(--u)); left: calc(100% - var(--h) * var(--u)); transform-origin: right; transform: rotateY(90deg); }
.tb3d-f.w { top: 0; height: 100%; left: 0; width: calc(var(--h) * var(--u)); transform-origin: left; transform: rotateY(-90deg); }
.tb3d-f.b { left: 0; top: 0; right: 0; bottom: 0; transform: rotateX(180deg); }
.tb3d-disc {
  position: absolute; border-radius: 50%;
  left: calc(var(--x) * var(--u)); top: calc(var(--y) * var(--u));
  width: calc(var(--w) * var(--u)); height: calc(var(--w) * var(--u));
  transform: translateZ(calc(var(--z) * var(--u)));
}
.tb3d-layer { position: absolute; pointer-events: none; }
.tb3d-layer > svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tb3d-jack { cursor: pointer; }
.tb3d-jack.tb3d-dim { cursor: not-allowed; }
.tb3d-jack.tb3d-dim > .tb3d-f { opacity: 0.3; }
.tb3d-hl { position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; border-radius: calc(4 * var(--u)); }
.tb3d-hl.tb3d-fit { animation: tb3dGlow 1s ease-in-out infinite; }
.tb3d-hl.tb3d-flash { animation: tbFadeIn .45s ease reverse forwards; }
.tb3d-led-glow { position: absolute; left: 50%; top: 50%; width: calc(26 * var(--u)); height: calc(26 * var(--u)); transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .tb-trace-pulse { animation: none !important; opacity: 0; }
  .tb-led-beat { animation: none !important; }
  .tb3d-hl.tb3d-fit { animation: none; opacity: 1; }
}
html, body, #root { margin: 0; height: 100%; }
* { box-sizing: border-box; }
button, input { font-family: inherit; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 8px; }
`;

const Keyframes = () => {
    const {K, theme} = useStudio();

    useEffect(() => {
        const el = document.createElement('style');
        el.setAttribute('data-tb-beginner', '1');
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    }, []);

    useEffect(() => {
        document.documentElement.style.background = K.bg;
        document.body.style.background = K.bg;
        document.documentElement.style.colorScheme = theme;
    }, [K.bg, theme]);

    return null;
};

export default Keyframes;
