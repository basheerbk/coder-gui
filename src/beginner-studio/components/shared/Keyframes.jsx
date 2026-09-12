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
