import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useState} from 'react';

import {SITE_CONFIG, isRealUrl} from './site-config';

const SECTION_LINKS = [
    {hash: 'how', label: 'How it works'},
    {hash: 'makerspaces', label: 'Makerspaces'},
    {hash: 'about', label: 'About'}
];

/**
 * On the homepage links are plain #hashes; elsewhere they point back to /#hash.
 * @param {string} hash section id without the #.
 * @param {boolean} onHome whether the link is rendered on the homepage.
 * @returns {string} link href.
 */
const sectionHref = (hash, onHome) => (onHome ? `#${hash}` : `/#${hash}`);

const BrandMark = () => (
    <span
        className="tb-brand-mark"
        aria-hidden="true"
    >TB</span>
);

const SiteHeader = ({onHome}) => {
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        const onKey = event => {
            if (event.key === 'Escape') {
                setNavOpen(false);
            }
        };
        if (navOpen) {
            window.addEventListener('keydown', onKey);
        }
        return () => window.removeEventListener('keydown', onKey);
    }, [navOpen]);

    const closeNav = useCallback(() => setNavOpen(false), []);
    const toggleNav = useCallback(() => setNavOpen(open => !open), []);

    return (
        <header className="tb-header">
            <div className="tb-container tb-header-inner">
                <a
                    className="tb-brand"
                    href={onHome ? '#top' : '/'}
                >
                    <BrandMark />
                    <span className="tb-brand-name">TinkerBit</span>
                </a>
                <button
                    className="tb-nav-toggle"
                    type="button"
                    aria-label={navOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={navOpen ? 'true' : 'false'}
                    aria-controls="siteNav"
                    onClick={toggleNav}
                >
                    <span /><span /><span />
                </button>
                <nav
                    className={`tb-nav${navOpen ? ' is-open' : ''}`}
                    id="siteNav"
                    aria-label="Main"
                >
                    {SECTION_LINKS.map(link => (
                        <a
                            className="tb-nav-link"
                            key={link.hash}
                            href={sectionHref(link.hash, onHome)}
                            onClick={closeNav}
                        >{link.label}</a>
                    ))}
                    <a
                        className="tb-btn tb-nav-cta"
                        href={sectionHref('notify', onHome)}
                        onClick={closeNav}
                    >Get notified</a>
                </nav>
            </div>
        </header>
    );
};

SiteHeader.propTypes = {
    onHome: PropTypes.bool
};

const SiteFooter = ({onHome}) => {
    const year = new Date().getFullYear();
    const {social, contactEmail} = SITE_CONFIG;
    return (
        <footer className="tb-footer">
            <div className="tb-container tb-footer-inner">
                <div className="tb-footer-top">
                    <div className="tb-footer-brand">
                        <div className="tb-footer-logo">
                            <BrandMark />
                            <span className="tb-brand-name">TinkerBit</span>
                        </div>
                        <p className="tb-footer-tagline">Click it in. Code it. Watch it come alive.</p>
                    </div>
                    <div className="tb-footer-cols">
                        <nav
                            className="tb-footer-col"
                            aria-labelledby="footerExplore"
                        >
                            <p
                                className="tb-footer-heading"
                                id="footerExplore"
                            >EXPLORE</p>
                            <ul>
                                {SECTION_LINKS.map(link => (
                                    <li key={link.hash}>
                                        <a href={sectionHref(link.hash, onHome)}>{link.label}</a>
                                    </li>
                                ))}
                                <li><a href="/privacy">Privacy</a></li>
                            </ul>
                        </nav>
                        <nav
                            className="tb-footer-col"
                            aria-labelledby="footerConnect"
                        >
                            <p
                                className="tb-footer-heading"
                                id="footerConnect"
                            >CONNECT</p>
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
                        </nav>
                    </div>
                </div>
                <div className="tb-footer-bottom">
                    <p>© {year} TinkerBit · Built for makers at every age</p>
                    <p>TB-01 · REV A</p>
                </div>
            </div>
        </footer>
    );
};

SiteFooter.propTypes = {
    onHome: PropTypes.bool
};

export {SiteHeader, SiteFooter};
