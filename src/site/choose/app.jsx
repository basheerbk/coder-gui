import React, {useEffect, useState} from 'react';

import {fetchAuthMe} from '../../lib/auth-client';
import {clarityEvent, identifyClarityUser} from '../../lib/clarity';

import './choose.css';

const isLocalHost = () => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
};

const App = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchAuthMe().then(session => {
            if (cancelled) {
                return;
            }
            if (session && session.authenticated) {
                identifyClarityUser(session);
                setReady(true);
                return;
            }
            if (isLocalHost()) {
                setReady(true);
                return;
            }
            window.location.replace('/login?next=' + encodeURIComponent('/choose'));
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleBeginner = () => {
        clarityEvent('mode_beginner');
    };

    const handleAdvanced = () => {
        clarityEvent('mode_advanced');
    };

    if (!ready) {
        return (
            <main className="choose-shell">
                <p className="choose-loading">Checking sign-in…</p>
            </main>
        );
    }

    return (
        <main className="choose-shell">
            <section
                className="choose-card"
                aria-labelledby="choose-title"
            >
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
                <h1 id="choose-title">How do you want to code?</h1>
                <p className="choose-lead">
                    Pick a path. You can switch later.
                </p>
                <div className="choose-actions">
                    <a
                        className="mode-btn mode-btn--beginner"
                        href="/beginner"
                        onClick={handleBeginner}
                    >
                        <span className="mode-label">Beginner</span>
                        <span className="mode-hint">Wire modules, click blocks, see live C++</span>
                    </a>
                    <a
                        className="mode-btn mode-btn--advanced"
                        href="/ide"
                        onClick={handleAdvanced}
                    >
                        <span className="mode-label">Advanced</span>
                        <span className="mode-hint">Full block IDE with boards and upload</span>
                    </a>
                </div>
            </section>
        </main>
    );
};

export default App;
