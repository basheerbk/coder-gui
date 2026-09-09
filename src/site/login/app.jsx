import React, {useEffect, useMemo, useState} from 'react';

import {clarityEvent, identifyClarityUser} from '../../lib/clarity';

import './login.css';

const ERROR_MESSAGES = {
    denied: 'Google sign-in was cancelled. Try again when you’re ready.',
    invalid: 'Something went wrong during sign-in. Please try again.',
    config: 'Sign-in isn’t configured on this server yet.'
};

const sanitizeNext = next => {
    if (!next || typeof next !== 'string') {
        return '/ide';
    }
    const pathOnly = next.split('?')[0].split('#')[0];
    if (
        next.charAt(0) !== '/' ||
        next.indexOf('//') === 0 ||
        next.indexOf('://') !== -1 ||
        !(pathOnly === '/ide' || pathOnly.indexOf('/ide/') === 0 || pathOnly === '/ide.html')
    ) {
        return '/ide';
    }
    return next;
};

const App = () => {
    const {next, error} = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            next: sanitizeNext(params.get('next') || '/ide'),
            error: params.get('error')
        };
    }, []);

    const [errorText] = useState(() => (error ? (ERROR_MESSAGES[error] || ERROR_MESSAGES.invalid) : ''));

    useEffect(() => {
        let cancelled = false;
        fetch('/api/auth/me', {credentials: 'same-origin'})
            .then(res => {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then(session => {
                if (cancelled || !session || !session.authenticated) {
                    return;
                }
                identifyClarityUser(session);
                window.location.replace(next);
            })
            .catch(() => {
                // Stay on login if auth API is unavailable.
            });
        return () => {
            cancelled = true;
        };
    }, [next]);

    const handleGoogleClick = () => {
        clarityEvent('sign_in_clicked');
    };

    return (
        <main className="login-shell">
            <section
                className="login-card"
                aria-labelledby="login-title"
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
                <h1 id="login-title">Sign in</h1>
                {errorText ? (
                    <p className="error">{errorText}</p>
                ) : null}
                <a
                    className="google-btn"
                    href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                    onClick={handleGoogleClick}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            fill="#FFC107"
                            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
                        />
                        <path
                            fill="#FF3D00"
                            d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
                        />
                        <path
                            fill="#4CAF50"
                            d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z"
                        />
                        <path
                            fill="#1976D2"
                            d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.8-4.7 6.6-8.8 7.3l.1.1 6.2 5.2C36.8 38.5 44 33 44 24c0-1.3-.1-2.5-.4-3.5z"
                        />
                    </svg>
                    Continue with Google
                </a>
                <a
                    className="back"
                    href="/"
                >Back</a>
            </section>
        </main>
    );
};

export default App;
