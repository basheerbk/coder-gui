import React, {useEffect, useRef, useState} from 'react';

import {logout} from '../../../lib/auth-client';
import {useStudio} from '../../context/StudioContext.jsx';
import {forgetAll, forgetSessionSecrets} from '../../domain/cloudSecrets';

/**
 * Confirms sign-out. The project is autosaved for next time unless the student is on a
 * shared computer and asks to remove their project, WiFi and Cloud keys from it.
 */
const SignOutDialog = ({onCancel}) => {
    const {K, user, cloud, saveNow, forgetLocalProject} = useStudio();
    const [shared, setShared] = useState(false);
    const [busy, setBusy] = useState(false);
    const cancelRef = useRef(null);

    useEffect(() => {
        if (cancelRef.current) {
            cancelRef.current.focus();
        }
        const onKey = e => {
            if (e.key === 'Escape' && !busy) {
                onCancel();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);

    const emails = [user && user.email, cloud && cloud.email]
        .filter(Boolean)
        .filter((e, i, list) => list.indexOf(e) === i);

    const confirm = () => {
        if (busy) {
            return;
        }
        setBusy(true);
        if (shared) {
            forgetLocalProject();
            emails.forEach(forgetAll);
        } else {
            saveNow();
            emails.forEach(forgetSessionSecrets);
        }
        logout();
    };

    return (
        <div
            role="presentation"
            onPointerDown={e => {
                if (e.target === e.currentTarget && !busy) {
                    onCancel();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tb-signout-title"
                style={{
                    width: 380,
                    maxWidth: '100%',
                    background: K.panel,
                    color: K.text,
                    border: `1px solid ${K.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.35)'
                }}
            >
                <h2 id="tb-signout-title" style={{margin: '0 0 6px', fontSize: 17}}>{'Sign out?'}</h2>
                <p style={{margin: '0 0 14px', fontSize: 13, color: K.sub, lineHeight: 1.5}}>
                    {shared ?
                        'Your project, WiFi and Cloud keys will be removed from this computer.' :
                        'Your project stays saved on this computer for next time.'}
                </p>
                <label
                    style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        padding: 10,
                        borderRadius: 10,
                        background: K.surface,
                        fontSize: 13,
                        lineHeight: 1.45,
                        cursor: 'pointer'
                    }}
                >
                    <input
                        type="checkbox"
                        checked={shared}
                        onChange={e => setShared(e.target.checked)}
                        style={{marginTop: 2, width: 16, height: 16, flexShrink: 0}}
                    />
                    <span>
                        <strong>{'This is a shared computer'}</strong>
                        <br />
                        <span style={{color: K.dim}}>
                            {'Remove my project, WiFi and Cloud keys. My board will need Cloud setup again.'}
                        </span>
                    </span>
                </label>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18}}>
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        style={{
                            border: `1px solid ${K.border}`,
                            background: 'transparent',
                            color: K.text,
                            borderRadius: 9,
                            padding: '8px 16px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={busy}
                        style={{
                            border: 'none',
                            background: K.red,
                            color: '#fff',
                            borderRadius: 9,
                            padding: '8px 16px',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: busy ? 'wait' : 'pointer',
                            opacity: busy ? 0.7 : 1
                        }}
                    >
                        {busy ? 'Signing out…' : 'Sign out'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignOutDialog;
