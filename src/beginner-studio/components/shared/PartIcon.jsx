import React, {useState} from 'react';

import {MODULE_ICONS} from '../module-icons/module-icons';
import ModuleIcon from './ModuleIcon.jsx';

const uris = {};

/** Data URI for a part's colour icon, or null when the part has none. */
const partIconUri = id => {
    if (!Object.prototype.hasOwnProperty.call(MODULE_ICONS, id)) {
        return null;
    }
    if (!uris[id]) {
        uris[id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MODULE_ICONS[id])}`;
    }
    return uris[id];
};

/**
 * A part's colour picture; falls back to the line glyph in `color` for parts without one.
 * Kept as an <img>: the icons drop their fine detail below 28 px through a media query that only
 * sees the image's own width when the SVG is not inlined into the page.
 */
const PartIcon = ({id, color, size = 36, muted = false}) => {
    const [failedId, setFailedId] = useState(null);
    const src = failedId === id ? null : partIconUri(id);
    if (!src) {
        return <ModuleIcon id={id} color={color} size={Math.round(size * 0.66)} />;
    }
    return (
        <img
            src={src}
            alt=""
            aria-hidden
            width={size}
            height={size}
            draggable={false}
            onError={() => setFailedId(id)}
            style={{
                display: 'block',
                flexShrink: 0,
                pointerEvents: 'none',
                filter: muted ? 'grayscale(1)' : 'none',
                transition: 'filter 0.15s ease'
            }}
        />
    );
};

export {partIconUri};
export default PartIcon;
