(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '/ide';
    // Open-redirect guard (mirror server allowlist)
    var pathOnly = next.split('?')[0].split('#')[0];
    if (
        next.charAt(0) !== '/' ||
        next.indexOf('//') === 0 ||
        next.indexOf('://') !== -1 ||
        !(pathOnly === '/ide' || pathOnly.indexOf('/ide/') === 0 || pathOnly === '/ide.html')
    ) {
        next = '/ide';
    }

    var googleBtn = document.getElementById('googleBtn');
    if (googleBtn) {
        googleBtn.setAttribute('href', '/api/auth/google?next=' + encodeURIComponent(next));
    }

    var errorEl = document.getElementById('loginError');
    var error = params.get('error');
    if (errorEl && error) {
        var messages = {
            denied: 'Google sign-in was cancelled. Try again when you’re ready.',
            invalid: 'Something went wrong during sign-in. Please try again.',
            config: 'Sign-in isn’t configured on this server yet. Ask the site admin to set Google OAuth keys.'
        };
        errorEl.textContent = messages[error] || messages.invalid;
        errorEl.hidden = false;
    }

    // If already signed in, skip straight to the IDE.
    fetch('/api/auth/me', {credentials: 'same-origin'})
        .then(function (res) {
            if (res.ok) {
                window.location.replace(next);
            }
        })
        .catch(function () {
            // Stay on login page if auth API is unavailable.
        });
}());
