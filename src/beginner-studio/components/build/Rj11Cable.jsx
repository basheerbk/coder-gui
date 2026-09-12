import React, {useState} from 'react';

/** Molded puzzle tab — glossy plastic that seats in the U-notch. */
const tabPlug = (x, y, angleDeg, color, gid) => (
    <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`} filter="url(#plugPop)">
        <defs>
            <linearGradient id={`${gid}-tab`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="35%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id={`${gid}-boot`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="55%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
        </defs>
        {/* Drop under tab */}
        <path
            d="M -3,-10 L 11,-10 Q 18,-10 18,-3 L 18,3 Q 18,10 11,10 L -3,10 Z"
            fill="#020617"
            opacity={0.35}
            transform="translate(2, 3)"
        />
        {/* Colored latch tongue */}
        <path
            d="M -2,-10 L 11,-10 Q 18,-10 18,-3 L 18,3 Q 18,10 11,10 L -2,10 Z"
            fill={`url(#${gid}-tab)`}
            stroke={color}
            strokeWidth={1.4}
        />
        {/* Specular edge */}
        <path
            d="M 0,-8 L 10,-8 Q 15,-8 15,-4"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.55}
        />
        {/* Cable boot */}
        <rect x={-11} y={-7} width={12} height={14} rx={5} fill={`url(#${gid}-boot)`} stroke="#475569" strokeWidth={1} />
        <rect x={-9} y={-4} width={7} height={3} rx={1.2} fill="#ffffff" opacity={0.35} />
        <circle cx={14} cy={0} r={2.2} fill="#0f172a" opacity={0.35} />
        <circle cx={14} cy={0} r={1.3} fill="#fbbf24" opacity={0.9} />
    </g>
);

const controlFromHandle = (x1, y1, x2, y2, hx, hy) => ({
    x: (2 * hx) - ((x1 + x2) / 2),
    y: (2 * hy) - ((y1 + y2) / 2)
});

const Rj11Cable = ({
    x1,
    y1,
    x2,
    y2,
    handleX,
    handleY,
    dragging,
    onBendStart,
    color = '#94a3b8',
    connectionId = 'c'
}) => {
    const hx = handleX == null ? (x1 + x2) / 2 : handleX;
    const hy = handleY == null ? (y1 + y2) / 2 : handleY;
    const ctrl = controlFromHandle(x1, y1, x2, y2, hx, hy);
    const path = `M ${x1} ${y1} Q ${ctrl.x} ${ctrl.y} ${x2} ${y2}`;
    const jackAngle = Math.atan2(ctrl.y - y1, ctrl.x - x1) * (180 / Math.PI);
    const moduleAngle = Math.atan2(ctrl.y - y2, ctrl.x - x2) * (180 / Math.PI);
    const [hover, setHover] = useState(false);
    const gid = `cab-${connectionId}`;

    return (
        <g
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                strokeLinecap="round"
                style={{cursor: dragging ? 'grabbing' : 'grab'}}
                onPointerDown={e => {
                    if (e.button !== 0) {
                        return;
                    }
                    e.stopPropagation();
                    onBendStart(e);
                }}
            />
            {/* Floor contact shadow */}
            <path
                d={path}
                fill="none"
                stroke="rgba(2,6,23,0.4)"
                strokeWidth={12}
                strokeLinecap="round"
                transform="translate(2, 4)"
            />
            {/* Outer jacket */}
            <path
                d={path}
                fill="none"
                stroke="#0f172a"
                strokeWidth={11}
                strokeLinecap="round"
                opacity={0.55}
            />
            {/* Colored rubber */}
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={8}
                strokeLinecap="round"
                opacity={0.9}
            />
            {/* Mid tone */}
            <path
                d={path}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={5.5}
                strokeLinecap="round"
                opacity={0.55}
            />
            {/* Specular ridge */}
            <path
                d={path}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.75}
                transform="translate(0, -1.6)"
            />
            {tabPlug(x1, y1, jackAngle + 180, color, `${gid}-a`)}
            {tabPlug(x2, y2, moduleAngle + 180, color, `${gid}-b`)}
            {hover || dragging ? (
                <g filter="url(#plugPop)">
                    <ellipse
                        cx={hx + 1}
                        cy={hy + 2.5}
                        rx={8}
                        ry={5.5}
                        fill="#020617"
                        opacity={0.3}
                    />
                    <circle
                        cx={hx}
                        cy={hy}
                        r={dragging ? 8 : 7}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={2}
                        style={{cursor: dragging ? 'grabbing' : 'grab'}}
                        onPointerDown={e => {
                            if (e.button !== 0) {
                                return;
                            }
                            e.stopPropagation();
                            onBendStart(e);
                        }}
                    />
                    <circle cx={hx - 1.5} cy={hy - 1.8} r={2} fill="#ffffff" opacity={0.85} />
                </g>
            ) : null}
        </g>
    );
};

export default Rj11Cable;
