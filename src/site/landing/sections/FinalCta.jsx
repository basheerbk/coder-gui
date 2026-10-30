import React from 'react';

import WaitlistForm from '../WaitlistForm.jsx';

const FinalCta = () => (
    <section
        className="tb-cta"
        aria-labelledby="ctaTitle"
    >
        <div className="tb-container tb-cta-inner">
            <h2
                className="tb-h2 tb-cta-title"
                id="ctaTitle"
            >Click it in. Code it. Watch it come alive.</h2>
            <div className="tb-cta-form">
                <WaitlistForm
                    idPrefix="cta"
                    label="FIRST KITS SHIP DEC 2026"
                    onPurple
                />
            </div>
        </div>
    </section>
);

export default FinalCta;
