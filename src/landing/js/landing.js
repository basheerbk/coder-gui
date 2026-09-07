(function () {
    'use strict';

    var header = document.getElementById('siteHeader');
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('navMenu');
    var browserNote = document.getElementById('browserNote');
    var serialNote = document.getElementById('serialNote');
    var waitlistForm = document.getElementById('waitlistForm');
    var waitlistMsg = document.getElementById('waitlistMsg');
    var year = document.getElementById('year');

    if (year) {
        year.textContent = String(new Date().getFullYear());
    }

    var onScroll = function () {
        if (!header) return;
        header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});

    if (toggle && menu) {
        toggle.addEventListener('click', function () {
            var open = menu.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
        menu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                menu.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', 'Open menu');
            });
        });
    }

    var isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    var isNarrow = window.matchMedia('(max-width: 799px)').matches;
    var isMobileLike = isNarrow || (isCoarsePointer && window.innerWidth < 1024);
    var hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

    if (browserNote && isMobileLike) {
        browserNote.hidden = false;
    }

    if (serialNote && !isMobileLike && !hasSerial) {
        serialNote.hidden = false;
    }

    // On mobile-like devices, keep IDE links from dumping users into an unusable editor.
    if (isMobileLike) {
        document.querySelectorAll('[data-ide-link]').forEach(function (link) {
            link.setAttribute('href', '#how-it-works');
            link.removeAttribute('data-ide-link');
        });
    }

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var emailInput = document.getElementById('waitlistEmail');
            var email = emailInput && emailInput.value ? emailInput.value.trim() : '';
            if (!email) return;

            try {
                var list = JSON.parse(localStorage.getItem('tinkerbit-waitlist') || '[]');
                if (list.indexOf(email) === -1) {
                    list.push(email);
                    localStorage.setItem('tinkerbit-waitlist', JSON.stringify(list));
                }
            } catch (err) {
                // Ignore storage failures; still show success.
            }

            if (waitlistMsg) {
                waitlistMsg.textContent = 'Got it — we’ll nudge you when desktop coding is the next step.';
            }
            waitlistForm.reset();
        });
    }
}());
