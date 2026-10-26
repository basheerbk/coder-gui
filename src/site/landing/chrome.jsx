import React, {useEffect, useState} from 'react';

import {SITE_CONFIG, isRealUrl} from './site-config';

const SECTION_LINKS = [
    {hash: 'how-it-works', label: 'How it works'},
    {hash: 'gallery', label: 'Gallery'},
    {hash: 'schools', label: 'Schools'},
    {hash: 'about', label: 'About'}
];

/** On the homepage links are plain #hashes; elsewhere they point back to /#hash. */
const sectionHref = (hash, onHome) => (onHome ? `#${hash}` : `/#${hash}`);

const SiteHeader = ({onHome}) => {
    const [navOpen, setNavOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, {passive: true});
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!navOpen) {
            return undefined;
        }
        const onKey = event => {
            if (event.key === 'Escape') {
                setNavOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navOpen]);

    const closeNav = () => setNavOpen(false);

    return (
        <header className={`site-header${scrolled || navOpen ? ' is-scrolled' : ''}`}>
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
                    {SECTION_LINKS.map(link => (
                        <a
                            key={link.hash}
                            href={sectionHref(link.hash, onHome)}
                            onClick={closeNav}
                        >{link.label}</a>
                    ))}
                    <a
                        className="btn btn-primary btn-pill-nav"
                        href={sectionHref('notify', onHome)}
                        onClick={closeNav}
                    >Get notified</a>
                </nav>
            </div>
        </header>
    );
};

const SiteFooter = ({onHome}) => {
    const year = new Date().getFullYear();
    const {social, contactEmail} = SITE_CONFIG;
    return (
        <footer className="site-footer">
            <div className="container footer-grid">
                <div>
                    <div className="footer-brand">TinkerBit</div>
                    <p className="footer-tagline">Click it in. Code it. Watch it come alive.</p>
                </div>
                <div className="footer-col">
                    <p className="footer-heading">Explore</p>
                    <ul>
                        {SECTION_LINKS.map(link => (
                            <li key={link.hash}>
                                <a href={sectionHref(link.hash, onHome)}>{link.label}</a>
                            </li>
                        ))}
                        <li><a href="/privacy">Privacy</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <p className="footer-heading">Connect</p>
                    <ul>
                        <li><a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
                        {social.filter(item => isRealUrl(item.url)).map(item => (
                            <li key={item.label}>
                                <a
                                    href={item.url}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >{item.label}</a>
                            </li>
                        ))}
                        <li><a href="/login">Sign in (early access)</a></li>
                    </ul>
                </div>
            </div>
            <div className="container footer-bottom">
                <p>© {year} TinkerBit. Built for makers at every age.</p>
            </div>
        </footer>
    );
};

export {SiteHeader, SiteFooter};
