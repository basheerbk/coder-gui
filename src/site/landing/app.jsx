import React, {useEffect, useState} from 'react';

import {SiteFooter, SiteHeader} from './chrome.jsx';
import IMAGES from './images';
import Picture from './Picture.jsx';
import {SITE_CONFIG} from './site-config';
import WaitlistForm from './WaitlistForm.jsx';

import './landing.css';

const detectMobileLike = () => {
    const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const isNarrow = window.matchMedia('(max-width: 799px)').matches;
    return isNarrow || (isCoarsePointer && window.innerWidth < 1024);
};

const MODULE_POINTS = [
    {
        tone: 'orange',
        text: 'Color-labeled modules so kids grab the right part without a wiring chart.',
        icon: (
            <React.Fragment>
                <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
                <circle
                    cx="7.5"
                    cy="7.5"
                    r="1.5"
                />
            </React.Fragment>
        )
    },
    {
        tone: 'teal',
        text: 'Firm click-in ports, so builds stay together through the whole experiment.',
        icon: <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4" />
    },
    {
        tone: 'yellow',
        text: 'Swap a light for a sensor in seconds when curiosity takes a new turn.',
        icon: <path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />
    }
];

const App = () => {
    const [showSerialNote, setShowSerialNote] = useState(false);

    useEffect(() => {
        const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
        setShowSerialNote(!detectMobileLike() && !hasSerial);
    }, []);

    return (
        <React.Fragment>
            <a
                className="sr-only"
                href="#main"
            >Skip to content</a>

            <SiteHeader onHome />

            <main id="main">
                <section
                    className="hero"
                    aria-labelledby="hero-title"
                >
                    <div className="hero-bg">
                        <Picture
                            image={IMAGES.hero}
                            fetchpriority="high"
                        />
                    </div>
                    <div className="hero-inner">
                        <div className="hero-copy">
                            <p className="hero-brand">TinkerBit</p>
                            <h1 id="hero-title">Block coding meets real circuits</h1>
                            <p className="hero-sub">
                                Plug something in. Stack a few blocks. Watch your desk come alive with lights, sound
                                and motion. No soldering. No breadboard chaos.
                            </p>
                            <p className="hero-availability">
                                First kits ship {SITE_CONFIG.shipDate}. Get a note when they’re ready.
                            </p>
                            <div className="hero-cta-wrap">
                                <a
                                    className="btn btn-primary"
                                    href="#how-it-works"
                                >See how it works</a>
                                <WaitlistForm />
                                {showSerialNote ? (
                                    <p className="hero-note">
                                        This browser can’t talk to USB boards yet. Try Chrome or Edge on a desktop to upload your builds.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="what-it-is section"
                    aria-label="What TinkerBit is"
                >
                    <div className="container">
                        <p>
                            One board. Colorful modules. Blocks that make something real happen.
                        </p>
                    </div>
                </section>

                <section
                    className="section section--tint"
                    id="how-it-works"
                    aria-labelledby="how-title"
                >
                    <div className="container">
                        <p className="section-kicker">How it works</p>
                        <h2 id="how-title">Three moves. Something happens.</h2>
                        <p className="section-lead">No breadboard maze. No soldering iron. Just click, code, and look.</p>
                        <div className="steps">
                            <article className="step">
                                <span
                                    className="step-num"
                                    aria-hidden="true"
                                >1</span>
                                <h3>Plug a module into the board</h3>
                                <p>Modules click into the board. Firm, obvious and kid-friendly.</p>
                            </article>
                            <article className="step">
                                <span
                                    className="step-num"
                                    aria-hidden="true"
                                >2</span>
                                <h3>Drag blocks to program it</h3>
                                <p>Snap colorful blocks together on screen to say what should blink, beep, or sense.</p>
                            </article>
                            <article className="step">
                                <span
                                    className="step-num"
                                    aria-hidden="true"
                                >3</span>
                                <h3>Watch it come alive</h3>
                                <p>Upload from the browser and the board answers with light, sound and motion, right on the table.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section
                    className="section"
                    id="gallery"
                    aria-labelledby="gallery-title"
                >
                    <div className="container">
                        <p className="section-kicker">Build gallery</p>
                        <h2 id="gallery-title">Things kids actually make</h2>
                        <p className="section-lead">Starter builds that click together in minutes and feel real on the table.</p>
                        <div className="gallery-grid">
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <Picture
                                        image={IMAGES.galleryNightlight}
                                        lazy
                                    />
                                </div>
                                <h3>Night Owl Nightlight</h3>
                                <p>A soft glow that comes alive when the room goes quiet.</p>
                            </article>
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <Picture
                                        image={IMAGES.galleryDoorbell}
                                        lazy
                                    />
                                </div>
                                <h3>Door Beep Doorbell</h3>
                                <p>Press the button, hear a cheerful buzz. A classic first win.</p>
                            </article>
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <Picture
                                        image={IMAGES.galleryBot}
                                        lazy
                                    />
                                </div>
                                <h3>Desk Rover</h3>
                                <p>Two motors, a little chassis, and a path it can follow across the table.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section
                    className="section section--warm"
                    id="modules"
                    aria-labelledby="why-title"
                >
                    <div className="container">
                        <p className="section-kicker">Snap-in modules</p>
                        <h2 id="why-title">Lights, buzzers, sensors. Click and go.</h2>
                        <div className="split split--center">
                            <p
                                className="section-lead"
                                style={{margin: 0}}
                            >
                                Every piece has a job you can see. Plug in a light, a button, or a sensor, stack a few
                                blocks, and the table answers back. When the idea changes, swap the module. The board
                                stays put.
                            </p>
                            <ul className="point-list">
                                {MODULE_POINTS.map(point => (
                                    <li key={point.tone}>
                                        <span
                                            className={`point-icon point-icon--${point.tone}`}
                                            aria-hidden="true"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                {point.icon}
                                            </svg>
                                        </span>
                                        <span>{point.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section
                    className="section"
                    id="trust"
                    aria-labelledby="trust-title"
                >
                    <div className="container">
                        <p className="section-kicker">Trust &amp; safety</p>
                        <h2 id="trust-title">Built for curious hands</h2>
                        <div className="trust-grid">
                            <article className="trust-item">
                                <h3>Ages 8+ · low voltage</h3>
                                <p>Designed for kids with adult nearby as needed. The kit runs at kid-friendly low voltage, with no mains wiring on the modules.</p>
                            </article>
                            <article className="trust-item">
                                <h3>What’s in the box</h3>
                                <p>A main board, a starter set of plug-in modules (lights, sound, sensors), USB cable, and a quick-start card that points to the online IDE.</p>
                            </article>
                            <article className="trust-item">
                                <h3>Room to grow</h3>
                                <p>Start with blink-and-beep builds, then layer sensors and motion as confidence grows. Same board, more ambitious ideas.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section
                    className="section section--tint"
                    id="schools"
                    aria-labelledby="schools-title"
                >
                    <div className="container">
                        <div className="schools-panel">
                            <p className="section-kicker">For schools &amp; classrooms</p>
                            <h2 id="schools-title">Classroom-friendly kits without the cable chaos</h2>
                            <p>
                                Stations stay tidy when every module clicks into a known port. Teachers get a shared browser IDE,
                                so students can build on classroom PCs without installing desktop software.
                            </p>
                            <a
                                className="btn btn-outline"
                                href="mailto:hello@tinkerbit.io?subject=School%20programs"
                            >Talk to us about school programs</a>
                        </div>
                    </div>
                </section>

                <section
                    className="section"
                    id="about"
                    aria-labelledby="about-title"
                >
                    <div className="container">
                        <p className="section-kicker">About</p>
                        <h2 id="about-title">Made by people who still get excited when an LED turns on</h2>
                        <div className="about-panel">
                            <p>
                                We’ve spent years running hands-on STEM spaces, the kind where kids spill parts on tables
                                and leave grinning because something they built actually worked. TinkerBit grew out of that
                                mess and magic: fewer loose wires, clearer first wins, and a coding screen that feels as
                                tactile as the board on the desk.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <SiteFooter onHome />
        </React.Fragment>
    );
};

export default App;
