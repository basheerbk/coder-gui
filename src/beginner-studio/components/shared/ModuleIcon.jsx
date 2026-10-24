import React from 'react';

const stroke = {
    fill: 'none',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
};

const glyphs = {
    led: () => (
        <g transform="translate(0 6.46) scale(0.923)">
            <rect width="26" height="12" rx="1" fill="#36673B" />
            <path d="M18.1871 3V1.10277H18.5308V2.71189H19.3664V3H18.1871ZM19.6647 3V1.10277H20.8987V1.39087H20.0084V1.90594H20.8347V2.19405H20.0084V2.71189H20.9061V3H19.6647ZM21.8922 3H21.2493V1.10277H21.9052C22.0935 1.10277 22.2553 1.14075 22.3906 1.21671C22.5265 1.29206 22.6308 1.40044 22.7037 1.54187C22.7766 1.6833 22.813 1.85252 22.813 2.04953C22.813 2.24716 22.7763 2.417 22.7028 2.55904C22.6299 2.70109 22.5246 2.81009 22.3869 2.88605C22.2498 2.96202 22.0849 3 21.8922 3ZM21.593 2.70263H21.8755C22.0077 2.70263 22.1179 2.67854 22.2062 2.63037C22.2946 2.58158 22.3609 2.50902 22.4054 2.41267C22.4499 2.31571 22.4721 2.19466 22.4721 2.04953C22.4721 1.9044 22.4499 1.78397 22.4054 1.68824C22.3609 1.5919 22.2952 1.51995 22.2081 1.47239C22.1216 1.42422 22.0142 1.40014 21.8857 1.40014H21.593V2.70263Z" fill="white" />
            <path d="M0 1.5H13.5C13.7761 1.5 14 1.72386 14 2V10C14 10.2761 13.7761 10.5 13.5 10.5H0V1.5Z" fill="black" />
            <rect y="1.5" width="2" height="9" fill="#1D1D1D" />
            <rect y="3.5" width="2" height="5" fill="black" />
            <path d="M2 3.4H14M2 4.4H14M2 5.4H14M2 6.4H14M2 7.4H14M2 8.4H14" strokeWidth="0.2" stroke="white" />
            <rect x="2" y="2.5" width="1" height="7" fill="black" fillOpacity="0.78" />
            <path d="M1 10.5V11M1 1.5V1" strokeWidth="0.3" stroke="black" />
            <circle cx="20.5" cy="7.5" r="2.5" fill="#D9D9D9" fillOpacity="0.2" />
            <circle cx="20.5" cy="7.5" r="1.5" fill="#FFE100" fillOpacity="0.2" />
            <rect x="15" y="5" width="1" height="2.33333" rx="0.1" transform="rotate(-90 15 5)" fill="#D9D9D9" />
            <rect x="15.3333" y="5" width="1" height="1.66667" transform="rotate(-90 15.3333 5)" fill="black" />
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
    l293d: c => (
        <g stroke={c} {...stroke}>
            <rect x="5" y="6" width="14" height="12" rx="2" />
            <path d="M8 10h8M8 14h5M12 6v12" />
        </g>
    ),
    stepper: c => (
        <g stroke={c} {...stroke}>
            <circle cx="12" cy="12" r="7" />
            <path d="M12 5v3M12 16v3M5 12h3M16 12h3M7.5 7.5l2 2M14.5 14.5l2 2M16.5 7.5l-2 2M9.5 14.5l-2 2" />
        </g>
    ),
    gas: c => (
        <g stroke={c} {...stroke}>
            <path d="M7 16c2-2 2-5 0-7M12 18c3-3 3-8 0-11M17 16c2-2 2-5 0-7" />
        </g>
    ),
    mq2: c => (
        <g stroke={c} {...stroke}>
            <path d="M7 16c2-2 2-5 0-7M12 18c3-3 3-8 0-11M17 16c2-2 2-5 0-7" />
            <rect x="9" y="17" width="6" height="3" rx="1" />
        </g>
    ),
    sound: c => (
        <g stroke={c} {...stroke}>
            <rect x="9" y="4" width="6" height="10" rx="3" />
            <path d="M12 14v3M8 20h8M8 17h8" />
        </g>
    ),
    mic: c => (
        <g stroke={c} {...stroke}>
            <rect x="9" y="4" width="6" height="10" rx="3" />
            <path d="M12 14v3M8 20h8M8 17h8" />
        </g>
    ),
    rfid: c => (
        <g stroke={c} {...stroke}>
            <rect x="4" y="7" width="16" height="10" rx="2" />
            <path d="M8 12h8M7 10a6 6 0 000 4M17 10a6 6 0 010 4" />
        </g>
    ),
    ble: c => (
        <g stroke={c} {...stroke}>
            <path d="M12 4v16M12 4l5 4-5 4 5 4-5 4M7 8l5 4M7 16l5-4" />
        </g>
    ),
    hc05: c => (
        <g stroke={c} {...stroke}>
            <rect x="5" y="7" width="14" height="10" rx="2" />
            <path d="M9 12h6M12 9v6" />
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
    relay4: c => (
        <g stroke={c} {...stroke}>
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M7 9h3M14 9h3M7 12h3M14 12h3M7 15h3M14 15h3" />
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
