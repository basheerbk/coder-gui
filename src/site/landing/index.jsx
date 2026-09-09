import React from 'react';
import ReactDOM from 'react-dom';
import {initialClarity} from '../../lib/clarity';
import App from './app.jsx';

try {
    initialClarity('landing');
} catch (err) {
    // Clarity must never block the page.
}

ReactDOM.render(<App />, document.getElementById('root'));
