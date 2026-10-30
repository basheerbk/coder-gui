import React from 'react';

import {SITE_CONFIG} from '../site-config';

const POINTS = [
    {n: '01', text: 'Workbenches stay tidy when every module clicks into a known port. Less sorting, more making.'},
    {
        n: '02',
        text: 'A shared browser IDE, so members build on any space computer without installing desktop software.'
    },
    {n: '03', text: 'Made by a team that runs hands-on STEM sessions with kids every week.'}
];

const PHOTO_ALT = 'An instructor holds up a laptop with a block-coding project while students follow along ' +
    'on their own laptops in a classroom.';

const CONTACT_HREF = `mailto:${SITE_CONFIG.contactEmail}?subject=${encodeURIComponent('Makerspace programs')}`;

const Makerspaces = () => (
    <section
        id="makerspaces"
        className="tb-makers grid-dark"
        aria-labelledby="makersTitle"
    >
        <div className="tb-container tb-makers-inner">
            <div className="tb-makers-copy">
                <p className="tb-eyebrow tb-eyebrow--gold">FOR MAKERSPACES &amp; STEM LABS</p>
                <h2
                    className="tb-h2"
                    id="makersTitle"
                >Makerspace kits without the cable chaos.</h2>
                <ol className="tb-makers-points">
                    {POINTS.map(point => (
                        <li key={point.n}>
                            <span
                                className="tb-makers-n"
                                aria-hidden="true"
                            >{point.n}</span>
                            <p>{point.text}</p>
                        </li>
                    ))}
                </ol>
                <a
                    className="tb-btn tb-btn--on-dark"
                    href={CONTACT_HREF}
                >Talk to us about makerspace programs</a>
            </div>
            <figure className="tb-makers-photo">
                <figcaption className="tb-fig-head">
                    <span>
                        <span className="tb-text-gold">FIG. 02</span> — A HANDS-ON CODING SESSION
                    </span>
                </figcaption>
                <picture>
                    <source
                        srcSet="/static/landing/makerspace.webp"
                        type="image/webp"
                    />
                    <img
                        src="/static/landing/makerspace.jpg"
                        alt={PHOTO_ALT}
                        width="960"
                        height="868"
                        loading="lazy"
                        decoding="async"
                    />
                </picture>
            </figure>
        </div>
    </section>
);

export default Makerspaces;
