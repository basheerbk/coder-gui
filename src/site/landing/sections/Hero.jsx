import React from 'react';

import BoardIso from '../illustrations/BoardIso';
import WaitlistForm from '../WaitlistForm.jsx';

const Hero = () => (
    <section
        id="top"
        className="tb-hero grid-light"
        aria-labelledby="heroTitle"
    >
        <div className="tb-container tb-hero-inner">
            <div className="tb-hero-copy">
                <p className="tb-pill">
                    <span
                        className="tb-pill-dot"
                        aria-hidden="true"
                    />
                    TB-01 · FIRST KITS SHIP DEC 2026
                </p>
                <h1
                    className="tb-hero-title"
                    id="heroTitle"
                >
                    Block coding meets <span className="tb-text-purple">real circuits.</span>
                </h1>
                <p className="tb-hero-lead">
                    Plug something in. Stack a few blocks. Watch your desk come alive with lights, sound and
                    motion. No soldering. No breadboard chaos. Start with blinking lights, then grow
                    into <b>IoT</b> and <b>edge AI</b> on the same board.
                </p>
                <WaitlistForm
                    formId="notify"
                    idPrefix="hero"
                    label="GET A NOTE WHEN KITS SHIP"
                    showPrivacy
                />
                <a
                    className="tb-hero-link"
                    href="#how"
                >
                    See how it works <span aria-hidden="true">→</span>
                </a>
            </div>
            <figure className="tb-hero-figure">
                <figcaption className="tb-fig-head">
                    <span>FIG. 01 — TB-01 MAIN BOARD</span>
                    <span className="tb-text-gold">REV A</span>
                </figcaption>
                <div className="tb-hero-art">
                    <BoardIso />
                </div>
            </figure>
        </div>
    </section>
);

export default Hero;
