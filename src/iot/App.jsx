import React, {useEffect, useState} from 'react';

import {fontFamily, persistTheme, readStoredTheme, tokensFor} from '../beginner-studio/domain/tokens';
import {errorText, isTransient} from '../lib/iot-api';

import AccountPage from './components/AccountPage.jsx';
import AlertsPage from './components/AlertsPage.jsx';
import DevicePage from './components/DevicePage.jsx';
import DevicesPage from './components/DevicesPage.jsx';
import {linkTo, useRoute} from './router';
import {useCloudStore} from './store';
import {Banner, Button, ThemeContext} from './ui.jsx';

const useOnline = () => {
    const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);
    return online;
};

const useNarrow = () => {
    const [narrow, setNarrow] = useState(() => window.innerWidth < 460);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < 460);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return narrow;
};

const loginUrl = () => `/login?next=${encodeURIComponent(window.location.pathname)}`;

const Header = ({K, state, route, theme, setTheme}) => {
    const narrow = useNarrow();
    const nav = (path, label, active, badge) => (
        <a
            href={path}
            onClick={linkTo(path)}
            aria-current={active ? 'page' : undefined}
            style={{
                color: active ? K.text : K.dim,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                padding: '8px 6px',
                borderBottom: `2px solid ${active ? K.accent : 'transparent'}`,
                position: 'relative'
            }}
        >
            {label}
            {badge ? (
                <span
                    aria-label={`${badge} unread`}
                    style={{
                        marginLeft: 5,
                        background: K.red,
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: 11,
                        padding: '1px 6px'
                    }}
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : null}
        </a>
    );
    const liveLabel = {live: 'Live', connecting: 'Connecting…', polling: 'Reconnecting…', idle: ''}[state.live];
    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                background: K.panel,
                borderBottom: `1px solid ${K.border}`,
                padding: '0 14px'
            }}
        >
            <div style={{maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: narrow ? 8 : 12, minHeight: 52, flexWrap: 'wrap'}}>
                <a href="/iot" onClick={linkTo('/iot')} style={{display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: K.text}}>
                    <span
                        aria-hidden="true"
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            background: `linear-gradient(135deg, ${K.green}, ${K.cyan})`,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        TB
                    </span>
                    {narrow ? null : <span style={{fontWeight: 800, fontSize: 15}}>IoT Dashboard</span>}
                </a>
                <nav style={{display: 'flex', gap: narrow ? 4 : 10, flex: 1}}>
                    {nav('/iot', 'Boards', route.page === 'devices' || route.page === 'device')}
                    {nav('/iot/alerts', 'Alerts', route.page === 'alerts', state.unread)}
                    {nav('/iot/account', 'Data', route.page === 'account')}
                </nav>
                {liveLabel && narrow ? (
                    <span
                        role="img"
                        aria-label={liveLabel}
                        title={liveLabel}
                        style={{width: 8, height: 8, borderRadius: 4, background: state.live === 'live' ? K.green : K.orange}}
                    />
                ) : null}
                {liveLabel && !narrow ? (
                    <span style={{fontSize: 11, color: state.live === 'live' ? K.green : K.orange, fontWeight: 700}}>{liveLabel}</span>
                ) : null}
                <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    style={{background: K.surface, border: `1px solid ${K.border}`, color: K.text, borderRadius: 8, width: 34, height: 34, cursor: 'pointer'}}
                >
                    {theme === 'dark' ? '☀' : '☾'}
                </button>
                <a href="/beginner" style={{fontSize: 12, color: K.dim, textDecoration: 'none'}}>Studio</a>
            </div>
        </header>
    );
};

const App = () => {
    const [theme, setThemeState] = useState(readStoredTheme);
    const K = tokensFor(theme);
    const route = useRoute();
    const [state, actions] = useCloudStore(route);
    const online = useOnline();

    const setTheme = next => {
        persistTheme(next);
        setThemeState(next);
    };

    useEffect(() => {
        document.title = `${state.unread ? `(${state.unread}) ` : ''}IoT Dashboard · TinkerBit`;
    }, [state.unread]);

    useEffect(() => {
        document.body.style.margin = '0';
        document.body.style.background = K.bg;
        document.documentElement.style.colorScheme = theme;
    }, [K, theme]);

    useEffect(() => {
        if (!state.toast) {
            return undefined;
        }
        const t = setTimeout(() => actions.dispatch({type: 'toast/clear'}), 6000);
        return () => clearTimeout(t);
    }, [state.toast, actions]);

    useEffect(() => {
        if (state.configError === 'unauthenticated') {
            window.location.replace(loginUrl());
        }
    }, [state.configError]);

    let body;
    if (state.configError === 'unauthenticated') {
        body = <div style={{color: K.dim}}>Taking you to sign in…</div>;
    } else if (state.configError) {
        body = (
            <Banner tone="error" action={<Button onClick={() => window.location.reload()}>Try again</Button>}>
                {errorText(state.configError)}
                {isTransient({code: state.configError}) ? ' This page keeps trying by itself.' : ''}
            </Banner>
        );
    } else if (!state.config) {
        body = <div style={{color: K.dim}}>Loading…</div>;
    } else if (!state.config.allowed) {
        body = (
            <Banner tone="warn">
                TinkerBit Cloud is in a private pilot and {state.config.user && state.config.user.email ?
                    <b>{state.config.user.email}</b> : 'your account'} is not on the list yet. Ask your teacher to add it.
            </Banner>
        );
    } else if (!state.config.enabled) {
        body = <Banner tone="warn">TinkerBit Cloud is paused for maintenance. Your boards keep running and reconnect by themselves.</Banner>;
    } else if (route.page === 'device') {
        body = <DevicePage id={route.id} state={state} actions={actions} />;
    } else if (route.page === 'alerts') {
        body = <AlertsPage state={state} actions={actions} />;
    } else if (route.page === 'account') {
        body = <AccountPage state={state} actions={actions} />;
    } else {
        body = <DevicesPage state={state} actions={actions} />;
    }

    return (
        <ThemeContext.Provider value={K}>
            <div style={{fontFamily, background: K.bg, color: K.text, minHeight: '100vh'}}>
                <Header K={K} state={state} route={route} theme={theme} setTheme={setTheme} />
                <main style={{maxWidth: 1100, margin: '0 auto', padding: '16px 14px 40px'}}>
                    {!online ? (
                        <Banner tone="warn">You are offline. Values on this page may be old; it refreshes when you reconnect.</Banner>
                    ) : null}
                    {body}
                </main>
                {state.toast ? (
                    <div
                        role="status"
                        aria-live="polite"
                        onClick={() => actions.dispatch({type: 'toast/clear'})}
                        style={{
                            position: 'fixed',
                            left: 12,
                            right: 12,
                            bottom: 'calc(12px + env(safe-area-inset-bottom))',
                            maxWidth: 420,
                            margin: '0 auto',
                            background: K.panel,
                            border: `1px solid ${K.orange}`,
                            borderRadius: 12,
                            padding: '10px 14px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                            fontSize: 14,
                            zIndex: 20,
                            cursor: 'pointer'
                        }}
                    >
                        <b>{state.toast.deviceName || 'Alert'}</b>: {state.toast.message}
                    </div>
                ) : null}
            </div>
        </ThemeContext.Provider>
    );
};

export default App;
