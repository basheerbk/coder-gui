import {useEffect, useState} from 'react';

/** Width of an element, kept current as it resizes (falls back to window resize). */
const useWidth = ref => {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) {
            return undefined;
        }
        const measure = () => setWidth(el.clientWidth);
        measure();
        if (typeof window.ResizeObserver === 'function') {
            const ro = new window.ResizeObserver(measure);
            ro.observe(el);
            return () => ro.disconnect();
        }
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);
    return width;
};

const useWindowWidth = () => {
    const [width, setWidth] = useState(() => window.innerWidth);
    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return width;
};

export {useWidth, useWindowWidth};
