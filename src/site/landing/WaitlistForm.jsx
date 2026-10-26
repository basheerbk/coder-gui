import React, {useRef, useState} from 'react';

import {SITE_CONFIG} from './site-config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MESSAGES = {
    invalid: 'Please enter a valid email, like name@example.com.',
    rateLimited: 'Too many tries from this connection. Please wait a few minutes and try again.',
    failed: `Sorry, we couldn’t save your email just now. Please try again, or write to ${SITE_CONFIG.contactEmail}.`,
    success: 'Thanks! We’ll email you once. No spam.'
};

const WaitlistForm = () => {
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const inputRef = useRef(null);

    const fail = message => {
        inFlight.current = false;
        setStatus('idle');
        setError(message);
    };

    const handleSubmit = event => {
        event.preventDefault();
        if (inFlight.current) {
            return;
        }
        const value = email.trim();
        if (!EMAIL_RE.test(value) || value.length > 254) {
            setError(MESSAGES.invalid);
            if (inputRef.current) {
                inputRef.current.focus();
            }
            return;
        }
        inFlight.current = true;
        setStatus('submitting');
        setError('');
        fetch('/api/waitlist', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: value, company})
        })
            .then(res => res.json()
                .catch(() => ({}))
                .then(data => ({res, data})))
            .then(({res, data}) => {
                if (res.ok && data.ok) {
                    inFlight.current = false;
                    setStatus('success');
                    setEmail('');
                    return;
                }
                if (data.error === 'invalid_email') {
                    fail(MESSAGES.invalid);
                    return;
                }
                fail(res.status === 429 ? MESSAGES.rateLimited : MESSAGES.failed);
            })
            .catch(() => fail(MESSAGES.failed));
    };

    if (status === 'success') {
        return (
            <div
                className="waitlist"
                id="notify"
            >
                <p
                    className="waitlist-success"
                    role="status"
                >{MESSAGES.success}</p>
            </div>
        );
    }

    const submitting = status === 'submitting';
    return (
        <form
            className="waitlist"
            id="notify"
            onSubmit={handleSubmit}
            noValidate
        >
            <label htmlFor="waitlistEmail">Get notified when kits ship</label>
            <div className="waitlist-row">
                <input
                    ref={inputRef}
                    id="waitlistEmail"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? 'waitlistError waitlistPrivacy' : 'waitlistPrivacy'}
                    onChange={event => {
                        setEmail(event.target.value);
                        if (error) {
                            setError('');
                        }
                    }}
                    disabled={submitting}
                />
                <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting ? 'true' : 'false'}
                >{submitting ? 'Sending…' : 'Notify me'}</button>
            </div>
            <div
                className="waitlist-hp"
                aria-hidden="true"
            >
                <label htmlFor="waitlistCompany">Company</label>
                <input
                    id="waitlistCompany"
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={event => setCompany(event.target.value)}
                />
            </div>
            <p
                id="waitlistError"
                className="waitlist-error"
                role="alert"
            >{error}</p>
            <p
                id="waitlistPrivacy"
                className="waitlist-privacy"
            >
                We’ll only use this to tell you about TinkerBit. <a href="/privacy">Privacy</a>
            </p>
        </form>
    );
};

export default WaitlistForm;
