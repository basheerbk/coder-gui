import PropTypes from 'prop-types';
import React, {useCallback, useRef, useState} from 'react';

import {SITE_CONFIG} from './site-config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MESSAGES = {
    invalid: 'Please enter a valid email, like name@example.com.',
    rateLimited: 'Too many tries from this connection. Please wait a few minutes and try again.',
    failed: `Sorry, we couldn’t save your email just now. Please try again, or write to ${SITE_CONFIG.contactEmail}.`
};

// Posts to /api/waitlist (api/waitlist.mjs). The hidden "company" field is a honeypot for bots.
const WaitlistForm = ({formId, idPrefix, label, onPurple, showPrivacy}) => {
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const inputRef = useRef(null);

    const ids = {
        email: `${idPrefix}Email`,
        company: `${idPrefix}Company`,
        error: `${idPrefix}Error`,
        privacy: `${idPrefix}Privacy`
    };
    const className = `tb-waitlist${onPurple ? ' tb-waitlist--on-purple' : ''}`;

    const handleSubmit = useCallback(event => {
        event.preventDefault();
        if (inFlight.current) {
            return;
        }
        const fail = message => {
            inFlight.current = false;
            setStatus('idle');
            setError(message);
        };
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
    }, [email, company]);

    const handleEmailChange = useCallback(event => {
        setEmail(event.target.value);
        setError('');
    }, []);

    const handleCompanyChange = useCallback(event => setCompany(event.target.value), []);

    if (status === 'success') {
        return (
            <div
                className={className}
                id={formId}
            >
                <p
                    className="tb-waitlist-success"
                    role="status"
                >
                    <span
                        className="tb-waitlist-check"
                        aria-hidden="true"
                    >✓</span>
                    <span><strong>You’re on the list.</strong> We’ll email you once, when kits ship.</span>
                </p>
            </div>
        );
    }

    const submitting = status === 'submitting';
    const describedBy = [error ? ids.error : '', showPrivacy ? ids.privacy : ''].filter(Boolean).join(' ');
    return (
        <form
            className={className}
            id={formId}
            onSubmit={handleSubmit}
            noValidate
        >
            <label
                className="tb-waitlist-label"
                htmlFor={ids.email}
            >{label}</label>
            <div className="tb-waitlist-row">
                <input
                    ref={inputRef}
                    className="tb-waitlist-input"
                    id={ids.email}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={email}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={describedBy || null}
                    onChange={handleEmailChange}
                    disabled={submitting}
                />
                <button
                    className="tb-btn tb-waitlist-submit"
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting ? 'true' : 'false'}
                >{submitting ? 'Sending…' : 'Notify me'}</button>
            </div>
            <div
                className="tb-waitlist-hp"
                aria-hidden="true"
            >
                <label htmlFor={ids.company}>Company</label>
                <input
                    id={ids.company}
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={handleCompanyChange}
                />
            </div>
            <p
                id={ids.error}
                className="tb-waitlist-error"
                role="alert"
            >{error}</p>
            {showPrivacy ? (
                <p
                    id={ids.privacy}
                    className="tb-waitlist-note"
                >
                    We’ll only use this to tell you about TinkerBit. <a href="/privacy">Privacy</a>
                </p>
            ) : null}
        </form>
    );
};

WaitlistForm.propTypes = {
    formId: PropTypes.string,
    idPrefix: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    onPurple: PropTypes.bool,
    showPrivacy: PropTypes.bool
};

WaitlistForm.defaultProps = {
    onPurple: false,
    showPrivacy: false
};

export default WaitlistForm;
