import React from 'react';

/** WebP with PNG fallback for an entry from images.js. */
const Picture = ({image, lazy, ...imgProps}) => (
    <picture>
        <source
            srcSet={`${image.src}.webp`}
            type="image/webp"
        />
        <img
            src={`${image.src}.png`}
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading={lazy ? 'lazy' : undefined}
            decoding={lazy ? 'async' : undefined}
            {...imgProps}
        />
    </picture>
);

export default Picture;
