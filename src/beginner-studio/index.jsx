import React from 'react';
import ReactDOM from 'react-dom';
import 'regenerator-runtime/runtime';

import {ensureIdeAuth} from '../lib/auth-client';
import {clarityEvent, identifyClarityUser, initialClarity} from '../lib/clarity';

import App from './App.jsx';

try {
    initialClarity('beginner');
} catch (err) {
    // Clarity must never block the page.
}

ensureIdeAuth().then(session => {
    if (session === null) {
        return;
    }
    try {
        identifyClarityUser(session);
        clarityEvent('beginner_ide_opened');
    } catch (err) {
        // ignore analytics failures
    }
    ReactDOM.render(<App />, document.getElementById('root'));
}).catch(() => {
    ReactDOM.render(<App />, document.getElementById('root'));
});
