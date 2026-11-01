import React from 'react';
import ReactDOM from 'react-dom';
import 'regenerator-runtime/runtime';

import App from './App.jsx';

// Auth is checked by the first /api/iot/config call; a 401 there redirects to /login.
ReactDOM.render(<App />, document.getElementById('root'));
