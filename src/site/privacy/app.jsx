import React from 'react';

import {SiteFooter, SiteHeader} from '../landing/chrome.jsx';
import {SITE_CONFIG} from '../landing/site-config';

import '../tokens.css';
import '../site.css';
import './privacy.css';

const email = SITE_CONFIG.contactEmail;

const App = () => (
    <React.Fragment>
        <a
            className="sr-only tb-skip"
            href="#main"
        >Skip to content</a>

        <SiteHeader onHome={false} />

        <main
            id="main"
            className="privacy grid-light"
        >
            <div className="tb-container privacy-body">
                <p className="tb-eyebrow">PRIVACY</p>
                <h1>Your privacy, in plain words</h1>
                <p className="privacy-lead">
                    In short: if you ask to hear when kits ship, we keep your email address. We also look at how
                    people use this website so we can make it better. Ask us any time and we’ll delete your details.
                </p>
                <p className="privacy-updated">Last updated: 1 November 2026</p>

                <h2>Who this website is for</h2>
                <p>
                    This website is for parents, teachers and other grown-ups finding out about TinkerBit for the kids
                    in their lives. We don’t knowingly collect details from children. If you think a child has given
                    us their email address, write to <a href={`mailto:${email}`}>{email}</a> and we’ll delete it.
                </p>

                <h2>Your email address</h2>
                <p>
                    When you sign up to be told when kits ship, we save your email address and the date you signed
                    up. We only use it to tell you about TinkerBit, like when kits are ready.
                </p>
                <p>
                    It’s stored safely with the company that runs our website’s storage. We keep it until kits
                    ship and we’ve sent you that note, then we delete it. You can also ask us to remove it sooner.
                </p>

                <h2>How we learn what’s working</h2>
                <p>
                    We use a free tool from Microsoft, called Clarity, to see how visitors use this website: which
                    parts they read, what they click, and where they get stuck. It shows us patterns, not who you
                    are. It uses cookies (small files your browser saves) to tell one visit from another. We only use
                    this to improve the website. You can read how Microsoft handles this in the{' '}
                    <a
                        href="https://privacy.microsoft.com/privacystatement"
                        rel="noopener noreferrer"
                        target="_blank"
                    >Microsoft Privacy Statement</a>.
                </p>

                <h2>Signing in to the TinkerBit coding app</h2>
                <p>
                    The coding app is in early access. If you sign in with your Google account,
                    Google shares your name, email address and profile picture with us so you stay signed in. These
                    are kept in your browser, and signing out clears them. While you’re signed in, Clarity can link
                    your visits to your Google account so we can help if something goes wrong.
                </p>

                <h2>TinkerBit Cloud (connecting boards to WiFi)</h2>
                <p>
                    Cloud is in a small pilot. When you connect a board, we keep under your account: the board’s name,
                    the readings it sends (for example temperature or distance), when it was last online, its WiFi
                    signal strength, the switch and slider settings you choose, your dashboards, alert rules and
                    alerts.
                </p>
                <p>
                    Readings are kept in full detail for 2 days, as minute averages for 30 days and as hourly averages
                    for a year. Each board keeps its last 100 alerts. The WiFi password you type goes into your board
                    only; it never reaches our servers. Your browser can remember it on that computer if you tick
                    “remember”. Cloud runs on our own server in the United States.
                </p>
                <p>
                    On the Cloud “Data” page you can download everything we hold or delete it all at once, which
                    removes it straight away. Deleting a single board hides it at once and erases its data within
                    7 days. Copies in our server backups disappear as those backups are replaced.
                </p>

                <h2>Keeping the website running</h2>
                <p>
                    Like every website, the company that hosts ours sees basic details about your connection, such as
                    your internet address, so it can show you pages and keep the website safe. To stop spam sign-ups,
                    we also count sign-up attempts from each connection and clear that count within an hour.
                </p>

                <h2>Questions, or want your details deleted?</h2>
                <p>
                    Email <a href={`mailto:${email}?subject=Privacy%20request`}>{email}</a> from the address you signed
                    up with and tell us what you’d like: a copy of what we have, a correction, or deletion. We’ll
                    let you know once it’s done.
                </p>

                <p className="privacy-back">
                    <a
                        className="tb-btn"
                        href="/"
                    >Back to home</a>
                </p>
            </div>
        </main>

        <SiteFooter onHome={false} />
    </React.Fragment>
);

export default App;
