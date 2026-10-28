import React from 'react';

const FACE_KEYS = ['b', 's', 'n', 'e', 'w', 't'];

/**
 * A CSS 3D cuboid in board units. Position and size come in as custom
 * properties so the stylesheet can scale everything by --u.
 *
 * faces: {t, s, n, e, w, b} → {bg, radius, content}
 */
const Box = ({
    x,
    y,
    w,
    d,
    h,
    z = 0,
    faces,
    className,
    style,
    children,
    ...rest
}) => (
    <div
        className={className ? `tb3d-box ${className}` : 'tb3d-box'}
        style={{
            '--x': x,
            '--y': y,
            '--w': w,
            '--d': d,
            '--h': h,
            '--z': z,
            ...style
        }}
        {...rest}
    >
        {FACE_KEYS.map(key => {
            const face = faces[key];
            if (!face) {
                return null;
            }
            return (
                <div
                    key={key}
                    className={`tb3d-f ${key}`}
                    style={{
                        background: face.bg,
                        borderRadius: face.radius
                    }}
                >
                    {face.content}
                </div>
            );
        })}
        {children}
    </div>
);

/** Flat round disc floating at height z (used for stacked button caps). */
const Disc = ({x, y, size, z = 0, bg}) => (
    <div
        className="tb3d-disc"
        style={{
            '--x': x,
            '--y': y,
            '--w': size,
            '--z': z,
            'background': bg
        }}
    />
);

/** SVG drawn edge-to-edge inside a face. */
const FaceSvg = ({w, h, children}) => (
    <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
    >
        {children}
    </svg>
);

/** Same side colour on all four walls (south can differ for a lit front). */
const sides = (south, eastWest, north) => ({
    s: {bg: south},
    e: {bg: eastWest},
    w: {bg: eastWest},
    n: {bg: north || eastWest}
});

export {Box, Disc, FaceSvg, sides};
export default Box;
