import React from 'react';

const About = () => (
    <section
        id="about"
        className="tb-about"
        aria-labelledby="aboutTitle"
    >
        <div className="tb-container tb-about-inner">
            <div className="tb-about-head">
                <p className="tb-eyebrow">ABOUT</p>
                <h2
                    className="tb-h2 tb-about-title"
                    id="aboutTitle"
                >Made by people who still get excited when an LED turns on.</h2>
            </div>
            <p className="tb-about-text">
                We’ve spent years running hands-on STEM spaces, the kind where kids spill parts on tables and
                leave grinning because something they built actually worked. TinkerBit grew out of that mess and
                magic: fewer loose wires, clearer first wins, and a coding screen that feels as tactile as the
                board on the desk.
            </p>
        </div>
    </section>
);

export default About;
