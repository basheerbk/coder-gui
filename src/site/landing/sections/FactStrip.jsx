import React from 'react';

const FACTS = ['ONE BOARD', 'CLICK-IN MODULES', 'BLOCKS IN THE BROWSER', 'NO SOLDERING', 'IoT + EDGE AI'];

const FactStrip = () => (
    <section
        className="tb-facts"
        aria-label="Key facts"
    >
        <ul className="tb-container tb-facts-list">
            {FACTS.map(fact => (
                <li key={fact}>
                    <span aria-hidden="true">◆ </span>{fact}
                </li>
            ))}
        </ul>
    </section>
);

export default FactStrip;
