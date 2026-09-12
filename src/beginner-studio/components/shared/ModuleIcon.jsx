import React from 'react';

const stroke = {
    fill: 'none',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
};

const glyphs = {
    led: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="11" r="5" />
            <path d="M10 17h4M10 20h4M12 4v1M5.5 6.5l.8.8M18.5 6.5l-.8.8M4 12h1M19 12h1" />
        </g>
    ),
    buzz: c => (
        <g stroke={c} {...stroke}>
            <path d="M8 10H5v4h3l4 3V7L8 10z" />
            <path d="M16 9.5a4 4 0 010 5M18.5 7.5a7 7 0 010 9" />
        </g>
    ),
    oled: c => (
        <g stroke={c} {...stroke}>
            <rect x="4" y="6" width="16" height="12" rx="2" />
            <path d="M8 18h8M9 10h6M9 13h4" />
        </g>
    ),
    servo: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="13" r="3" />
            <path d="M12 13L18 7M16 6h3v3" />
            <path d="M6 18h12" />
        </g>
    ),
    dc: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="12" r="7" />
            <path d="M12 7l2 5-2 5-2-5z" />
        </g>
    ),
    pump: c => (
        <g stroke={c} {...stroke}>
            <path d="M12 5s5 6 5 9a5 5 0 11-10 0c0-3 5-9 5-9z" />
        </g>
    ),
    relay: c => (
        <g stroke={c} {...stroke}>
            <path d="M5 12h5M14 12h5" />
            <circle cx="10" cy="12" r="1.4" fill={c} stroke="none" />
            <path d="M11 12l4-4" />
        </g>
    ),
    rgb: c => (
        <g>
            <circle cx="8" cy="13" r="3" fill="none" stroke={c} strokeWidth="1.6" />
            <circle cx="12" cy="9" r="3" fill="none" stroke={c} strokeWidth="1.6" />
            <circle cx="16" cy="13" r="3" fill="none" stroke={c} strokeWidth="1.6" />
        </g>
    ),
    ldr: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4" />
        </g>
    ),
    soil: c => (
        <g stroke={c} {...stroke}>
            <path d="M12 13c0-4 3-7 3-7s3 3 3 7a3 3 0 11-6 0z" />
            <path d="M9 13c-2-1-4-4-4-4s-1 4 1 6" />
            <path d="M4 20h16" />
        </g>
    ),
    gas: c => (
        <g stroke={c} {...stroke}>
            <path d="M7 16c2-2 2-5 0-7M12 18c3-3 3-8 0-11M17 16c2-2 2-5 0-7" />
        </g>
    ),
    flame: c => (
        <g stroke={c} {...stroke}>
            <path d="M12 20c3.5 0 6-2.4 6-6 0-4-4-7-4-10 0 0-2 3-2 6-1-2-3-3-3-6 0 4-3 7-3 10 0 3.6 2.5 6 6 6z" />
        </g>
    ),
    sound: c => (
        <g stroke={c} {...stroke}>
            <rect x="9" y="4" width="6" height="10" rx="3" />
            <path d="M12 14v3M8 20h8M8 17h8" />
        </g>
    ),
    pulse: c => (
        <g stroke={c} {...stroke}>
            <path d="M3 13h4l2-5 3 10 2-5h7" />
        </g>
    ),
    pot: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="13" r="6" />
            <path d="M12 13L16 8M12 7v2" />
        </g>
    ),
    btn: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="3" />
        </g>
    ),
    ultra: c => (
        <g stroke={c} {...stroke}>
            <path d="M8 16a6 6 0 018 0M6 13a9 9 0 0112 0M12 19h.01" />
        </g>
    ),
    dht: c => (
        <g stroke={c} {...stroke}>
            <rect x="10" y="3" width="4" height="12" rx="2" />
            <circle cx="12" cy="18" r="3" />
        </g>
    ),
    pir: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="8" r="2.5" />
            <path d="M8 20v-5a4 4 0 018 0v5" />
        </g>
    ),
    wait: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v6l4 2" />
        </g>
    ),
    repeat: c => (
        <g stroke={c} {...stroke}>
            <path d="M7 8h9l-2-2M17 16H8l2 2" />
        </g>
    ),
    if_then: c => (
        <g stroke={c} {...stroke}>
            <path d="M12 4l8 8-8 8-8-8z" />
        </g>
    ),
    serial_print: c => (
        <g stroke={c} {...stroke}>
            <path d="M6 8h12M6 12h8M6 16h10" />
        </g>
    ),
    serial_var: c => (
        <g stroke={c} {...stroke}>
            <path d="M6 8h12M6 12h8M6 16h10" />
        </g>
    )
};

const fallback = c => (
    <g stroke={c} {...stroke}>
        <rect x="5" y="5" width="14" height="14" rx="3" />
    </g>
);

const IconGlyph = ({name, color}) => (glyphs[name] || fallback)(color);

const ModuleIcon = ({id, color, size = 18, title}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : 'presentation'}
        style={{display: 'block', flexShrink: 0}}
    >
        {title ? <title>{title}</title> : null}
        <IconGlyph name={id} color={color} />
    </svg>
);

const ModuleIconSvg = ({id, color, x, y, size = 16}) => (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24">
        <IconGlyph name={id} color={color} />
    </svg>
);

export {ModuleIcon, ModuleIconSvg, IconGlyph};
export default ModuleIcon;
