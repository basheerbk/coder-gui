import React, {useEffect, useState} from 'react';

import './landing.css';

const detectMobileLike = () => {
    const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const isNarrow = window.matchMedia('(max-width: 799px)').matches;
    return isNarrow || (isCoarsePointer && window.innerWidth < 1024);
};

const App = () => {
    const [navOpen, setNavOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isMobileLike, setIsMobileLike] = useState(false);
    const [showBrowserNote, setShowBrowserNote] = useState(false);
    const [showSerialNote, setShowSerialNote] = useState(false);
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistMsg, setWaitlistMsg] = useState('');
    const year = new Date().getFullYear();

    useEffect(() => {
        const mobile = detectMobileLike();
        const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
        setIsMobileLike(mobile);
        setShowBrowserNote(mobile);
        setShowSerialNote(!mobile && !hasSerial);

        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, {passive: true});
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const ideHref = isMobileLike ? '#how-it-works' : '/ide';

    const closeNav = () => setNavOpen(false);

    const handleWaitlist = event => {
        event.preventDefault();
        const email = waitlistEmail.trim();
        if (!email) return;
        try {
            const list = JSON.parse(localStorage.getItem('tinkerbit-waitlist') || '[]');
            if (list.indexOf(email) === -1) {
                list.push(email);
                localStorage.setItem('tinkerbit-waitlist', JSON.stringify(list));
            }
        } catch (err) {
            // Ignore storage failures; still show success.
        }
        setWaitlistMsg('Got it — we’ll nudge you when desktop coding is the next step.');
        setWaitlistEmail('');
    };

    return (
        <React.Fragment>
            <a
                className="sr-only"
                href="#main"
            >Skip to content</a>

            <header
                className={`site-header${scrolled ? ' is-scrolled' : ''}`}
            >
                <div className="container nav-inner">
                    <a
                        className="brand"
                        href="/"
                    >
                        <span
                            className="brand-mark"
                            aria-hidden="true"
                        >TB</span>
                        <span>TinkerBit</span>
                    </a>
                    <button
                        className="nav-toggle"
                        type="button"
                        aria-label={navOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={navOpen ? 'true' : 'false'}
                        aria-controls="navMenu"
                        onClick={() => setNavOpen(!navOpen)}
                    >
                        <span /><span /><span />
                    </button>
                    <nav
                        className={`nav-links${navOpen ? ' is-open' : ''}`}
                        id="navMenu"
                        aria-label="Primary"
                    >
                        <a
                            href="#how-it-works"
                            onClick={closeNav}
                        >How it works</a>
                        <a
                            href="#gallery"
                            onClick={closeNav}
                        >Gallery</a>
                        <a
                            href="#schools"
                            onClick={closeNav}
                        >Schools</a>
                        <a
                            href="#about"
                            onClick={closeNav}
                        >About</a>
                        <a
                            className="btn btn-primary btn-pill-nav hero-cta-desktop"
                            href={ideHref}
                            onClick={closeNav}
                        >Open IDE</a>
                        <a
                            className="btn btn-primary btn-pill-nav hero-cta-mobile"
                            href="#how-it-works"
                            onClick={closeNav}
                        >Learn more</a>
                    </nav>
                </div>
            </header>

            <main id="main">
                <section
                    className="hero"
                    aria-labelledby="hero-title"
                >
                    <div className="hero-bg">
                        <img
                            src="/static/landing/hero.png"
                            width="1376"
                            height="768"
                            alt="A young maker coding a glowing TinkerBit robot on a laptop with colorful blocks"
                            fetchpriority="high"
                        />
                    </div>
                    <div className="hero-inner">
                        <div className="hero-copy">
                            <p className="hero-brand">TinkerBit</p>
                            <h1 id="hero-title">Block coding meets real circuits</h1>
                            <p className="hero-sub">
                                Snap RJ11 modules onto a board, drag colorful blocks on screen, and make lights flash,
                                buzzers beep, and sensors react — no wires, no soldering, no breadboard mess.
                            </p>
                            <div className="hero-cta-wrap">
                                <a
                                    className="btn btn-primary hero-cta-desktop"
                                    href={ideHref}
                                >Start Coding</a>
                                <a
                                    className="btn btn-primary hero-cta-mobile"
                                    href="#how-it-works"
                                >See how it works</a>
                                {showBrowserNote ? (
                                    <p className="hero-note">
                                        Best on a desktop computer with Chrome or Edge — that’s where the board connects through the browser.
                                    </p>
                                ) : null}
                                {showSerialNote ? (
                                    <p className="hero-note">
                                        This browser can’t talk to USB boards yet. Try Chrome or Edge on a desktop to upload your builds.
                                    </p>
                                ) : null}
                                <form
                                    className="waitlist is-mobile-default"
                                    onSubmit={handleWaitlist}
                                >
                                    <label htmlFor="waitlistEmail">Get a note when you’re ready to code on desktop</label>
                                    <div className="waitlist-row">
                                        <input
                                            id="waitlistEmail"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="you@email.com"
                                            required
                                            value={waitlistEmail}
                                            onChange={event => setWaitlistEmail(event.target.value)}
                                        />
                                        <button type="submit">Notify me</button>
                                    </div>
                                    <p
                                        className="waitlist-msg"
                                        role="status"
                                        aria-live="polite"
                                    >{waitlistMsg}</p>
                                </form>
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
                            It’s click-in circuits and drag-and-drop code — plug a module in, stack a few blocks,
                            and watch something real light up or move.
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
                                <p>RJ11 connectors click in like a phone handset jack — firm, obvious, and kid-friendly.</p>
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
                                <h3>Watch it react instantly</h3>
                                <p>Upload from the browser and the board answers — light, sound, motion, right on the table.</p>
                            </article>
                        </div>
                        <div className="rj11-demo">
                            <div className="rj11-demo-copy">
                                <h3>That click-in jack, explained</h3>
                                <p>
                                    RJ11 is the same style of connector you might remember from a landline phone —
                                    a small rectangular plug with a clip. On TinkerBit, each module (light, buzzer, sensor, motor)
                                    ends in that plug. Line it up with a port on the board, push until it clicks, and the circuit
                                    is ready. Pull the clip to unplug. No jumper wires to mix up.
                                </p>
                            </div>
                            <div className="rj11-frame">
                                <img
                                    src="/static/landing/rj11-click.png"
                                    width="1024"
                                    height="1024"
                                    loading="lazy"
                                    alt="Hand plugging an orange light sensor module into a TinkerBit board next to button, buzzer, and motion modules"
                                />
                            </div>
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
                        <p className="section-lead">Starter builds that click together in minutes — and feel real on the table.</p>
                        <div className="gallery-grid">
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <img
                                        src="/static/landing/gallery-nightlight.png"
                                        width="1024"
                                        height="1024"
                                        loading="lazy"
                                        alt="TinkerBit board with a glowing owl nightlight and warm maker desk props"
                                    />
                                </div>
                                <h3>Night Owl Nightlight</h3>
                                <p>A soft glow that comes alive when the room goes quiet.</p>
                            </article>
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <img
                                        src="/static/landing/gallery-doorbell.png"
                                        width="1024"
                                        height="1024"
                                        loading="lazy"
                                        alt="Child pressing a blue button module connected to a TinkerBit board and speaker"
                                    />
                                </div>
                                <h3>Door Beep Doorbell</h3>
                                <p>Press the button, hear a cheerful buzz — classic first win.</p>
                            </article>
                            <article className="gallery-item">
                                <div className="gallery-frame">
                                    <img
                                        src="/static/landing/gallery-bot.png"
                                        width="1024"
                                        height="1024"
                                        loading="lazy"
                                        alt="TinkerBit desk rover with ultrasonic eyes beside a laptop showing block code"
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
                    id="why-rj11"
                    aria-labelledby="why-title"
                >
                    <div className="container">
                        <p className="section-kicker">Why RJ11 modules</p>
                        <h2 id="why-title">No wires. No breadboard. Just click.</h2>
                        <div className="split">
                            <p
                                className="section-lead"
                                style={{margin: 0}}
                            >
                                Tiny jumper wires look clever until they fall out mid-demo. TinkerBit modules lock into
                                the board with an RJ11 click — the same solid feel as plugging in a phone handset —
                                so builds stay put while kids experiment.
                            </p>
                            <ul className="point-list">
                                <li>No soldering, no wire-strippers, no mysterious short circuits from a loose jumper.</li>
                                <li>Modules are labeled and color-friendly — grab a light, a sensor, a motor, and go.</li>
                                <li>Swap parts in seconds when the idea changes mid-afternoon.</li>
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
                                <p>Designed for kids with adult nearby as needed. The kit runs at kid-friendly low voltage — no mains wiring on the modules.</p>
                            </article>
                            <article className="trust-item">
                                <h3>What’s in the box</h3>
                                <p>A main board, a starter set of RJ11 modules (lights, sound, sensors), USB cable, and a quick-start card that points to the online IDE.</p>
                            </article>
                            <article className="trust-item">
                                <h3>Room to grow</h3>
                                <p>Start with blink-and-beep builds, then layer sensors and motion as confidence grows — same board, more ambitious ideas.</p>
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
                                We’ve spent years running hands-on STEM spaces — the kind where kids spill parts on tables
                                and leave grinning because something they built actually worked. TinkerBit grew out of that
                                mess and magic: fewer loose wires, clearer first wins, and a coding screen that feels as
                                tactile as the board on the desk.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="site-footer">
                <div className="container footer-grid">
                    <div>
                        <div className="footer-brand">TinkerBit</div>
                        <p className="footer-tagline">Click it in. Code it. Watch it come alive.</p>
                    </div>
                    <div className="footer-col">
                        <h2>Explore</h2>
                        <ul>
                            <li><a href="#how-it-works">How it works</a></li>
                            <li><a href="#gallery">Gallery</a></li>
                            <li><a href="#schools">Schools</a></li>
                            <li><a href="#about">About</a></li>
                            <li>
                                <a
                                    className="hero-cta-desktop"
                                    href={ideHref}
                                >Open IDE</a>
                            </li>
                        </ul>
                    </div>
                    <div className="footer-col">
                        <h2>Connect</h2>
                        <ul>
                            <li><a href="mailto:hello@tinkerbit.io">hello@tinkerbit.io</a></li>
                            <li>
                                <a
                                    href="https://tinkerbit.io/"
                                    rel="noopener noreferrer"
                                >tinkerbit.io</a>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="container footer-bottom">
                    <p>© {year} TinkerBit. Built for makers at every age.</p>
                </div>
            </footer>
        </React.Fragment>
    );
};

export default App;
