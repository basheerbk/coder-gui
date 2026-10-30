import React from 'react';

const SPECS = [
    {term: 'AGES', detail: '8+, with an adult nearby as needed.'},
    {term: 'POWER', detail: 'Kid-friendly low voltage. No mains wiring on the modules.'},
    {
        term: 'IN THE BOX',
        detail: 'Main board, a starter set of plug-in modules (lights, sound, sensors), USB cable and a ' +
            'quick-start card.'
    },
    {term: 'SOFTWARE', detail: 'Block coding in the browser. Nothing to install.'},
    {
        term: 'ROOM TO GROW',
        detail: 'Start with blink-and-beep, then add sensors, IoT over Wi-Fi and edge AI. Same board, bigger ideas.'
    }
];

const SpecSheet = () => (
    <section
        className="tb-spec"
        aria-labelledby="specTitle"
    >
        <div className="tb-container tb-spec-inner">
            <div className="tb-spec-intro">
                <p className="tb-eyebrow">TRUST &amp; SAFETY</p>
                <h2
                    className="tb-h2"
                    id="specTitle"
                >Built for curious hands.</h2>
                <p className="tb-lead">Everything a parent or teacher wants to know, on one spec sheet.</p>
            </div>
            <dl className="tb-spec-sheet">
                {SPECS.map(spec => (
                    <div
                        className="tb-spec-row"
                        key={spec.term}
                    >
                        <dt>{spec.term}</dt>
                        <dd>{spec.detail}</dd>
                    </div>
                ))}
            </dl>
        </div>
    </section>
);

export default SpecSheet;
