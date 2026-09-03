// Polyfills
import 'regenerator-runtime/runtime';
import 'es6-object-assign/auto';
import 'core-js/fn/array/includes';
import 'core-js/fn/promise/finally';
import 'intl'; // For Safari 9

import React from 'react';
import ReactDOM from 'react-dom';

import analytics, {initialAnalytics} from '../lib/analytics';
import AppStateHOC from '../lib/app-state-hoc.jsx';
import BrowserModalComponent from '../components/browser-modal/browser-modal.jsx';
import supportedBrowser from '../lib/supported-browser';

import styles from './index.css';

const setBootMessage = message => {
    window.__openblockAppStarted = true;
    if (window.__openblockSetBootMessage) {
        window.__openblockSetBootMessage(message);
    }
};

const hidePreloader = () => {
    window.__openblockAppReady = true;
    if (window.__openblockHidePreloader) {
        window.__openblockHidePreloader();
    }
};

const showBootError = message => {
    if (window.__openblockShowBootError) {
        window.__openblockShowBootError(message);
    }
};

try {
    setBootMessage('Starting…');

    try {
        initialAnalytics();
        analytics.send({hitType: 'pageview', page: '/community/web'});
    } catch (analyticsError) {
        // Analytics must never block the editor from loading.
        console.warn('Analytics init failed', analyticsError); // eslint-disable-line no-console
    }

    const appTarget = document.createElement('div');
    appTarget.className = styles.app;
    document.body.appendChild(appTarget);

    if (supportedBrowser()) {
        setBootMessage('Loading editor…');
        // require needed here to avoid importing unsupported browser-crashing code
        // at the top level
        require('./render-gui.jsx').default(appTarget);
    } else {
        BrowserModalComponent.setAppElement(appTarget);
        const WrappedBrowserModalComponent = AppStateHOC(BrowserModalComponent, true /* localesOnly */);
        const handleBack = () => {};
        // eslint-disable-next-line react/jsx-no-bind
        ReactDOM.render(<WrappedBrowserModalComponent onBack={handleBack} />, appTarget);
    }

    hidePreloader();
} catch (bootError) {
    showBootError(`Failed to start: ${bootError.message || bootError}`);
    throw bootError;
}
