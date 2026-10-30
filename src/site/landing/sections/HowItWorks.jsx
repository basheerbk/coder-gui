import React from 'react';

import StepClick from '../illustrations/StepClick';
import StepCode from '../illustrations/StepCode';
import StepWatch from '../illustrations/StepWatch';
import StepCard from './StepCard.jsx';

const STEPS = [
    {
        number: '01',
        tag: 'CLICK',
        art: StepClick,
        title: 'Plug a module into the board',
        text: 'Modules click into the board. Firm, obvious and kid-friendly.',
        footnote: 'NO TOOLS · NO WIRING CHART'
    },
    {
        number: '02',
        tag: 'CODE',
        art: StepCode,
        title: 'Drag blocks to program it',
        text: 'Snap colorful blocks together on screen to say what should blink, beep, or sense.',
        footnote: 'RUNS IN THE BROWSER · NO INSTALLS'
    },
    {
        number: '03',
        tag: 'WATCH',
        art: StepWatch,
        title: 'Watch it come alive',
        text: 'Upload from the browser and the board answers with light, sound and motion, right on the table.',
        footnote: 'LIGHT · SOUND · MOTION',
        highlight: true
    }
];

const HowItWorks = () => (
    <section
        id="how"
        className="tb-how grid-dark"
        aria-labelledby="howTitle"
    >
        <div className="tb-container tb-how-inner">
            <div className="tb-section-head">
                <div className="tb-section-title">
                    <p className="tb-eyebrow tb-eyebrow--gold">HOW IT WORKS · 03 STEPS</p>
                    <h2
                        className="tb-h2 tb-how-title"
                        id="howTitle"
                    >
                        Three moves. <span className="tb-text-gold">Something happens.</span>
                    </h2>
                </div>
                <p className="tb-lead tb-lead--on-dark tb-how-lead">
                    No breadboard maze. No soldering iron. Just click, code, and look.
                </p>
            </div>
            <ol className="tb-steps">
                {STEPS.map(step => (
                    <StepCard
                        key={step.number}
                        {...step}
                    />
                ))}
            </ol>
        </div>
    </section>
);

export default HowItWorks;
