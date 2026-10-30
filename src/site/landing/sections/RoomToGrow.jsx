import PropTypes from 'prop-types';
import React from 'react';

import LevelCircuits from '../illustrations/LevelCircuits';
import LevelEdgeAi from '../illustrations/LevelEdgeAi';
import LevelIot from '../illustrations/LevelIot';

const LEVELS = [
    {
        label: 'LEVEL 01 / CIRCUITS',
        art: LevelCircuits,
        title: 'Blink, beep, sense',
        text: 'Lights, buttons, buzzers and sensors. The first wins that make kids want to keep going.'
    },
    {
        label: 'LEVEL 02 / IoT',
        art: LevelIot,
        title: 'Connect it to the internet',
        text: 'Send sensor readings to a phone, switch things on from anywhere, build a weather station or a ' +
            'plant that texts you.'
    },
    {
        label: 'LEVEL 03 / EDGE AI',
        art: LevelEdgeAi,
        title: 'Teach it to recognise things',
        text: 'Train a tiny AI model to spot claps, voice words or gestures, and run it right on the board. ' +
            'No cloud needed.',
        dark: true
    }
];

const LevelCard = ({art: Art, dark, label, text, title}) => (
    <li className={`tb-level${dark ? ' tb-level--dark' : ''}`}>
        <p className="tb-level-label">{label}</p>
        <div className="tb-level-art">
            <Art />
        </div>
        <h3 className="tb-level-title">{title}</h3>
        <p className="tb-level-text">{text}</p>
    </li>
);

LevelCard.propTypes = {
    art: PropTypes.func.isRequired,
    dark: PropTypes.bool,
    label: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

LevelCard.defaultProps = {
    dark: false
};

const RoomToGrow = () => (
    <section
        id="grow"
        className="tb-grow grid-light"
        aria-labelledby="growTitle"
    >
        <div className="tb-container tb-grow-inner">
            <div className="tb-section-head">
                <div className="tb-section-title tb-section-title--wide">
                    <p className="tb-eyebrow">ROOM TO GROW · BLOCKS → IoT → EDGE AI</p>
                    <h2
                        className="tb-h2"
                        id="growTitle"
                    >From a blinking LED to a board that thinks.</h2>
                </div>
                <p className="tb-lead tb-grow-lead">
                    The ESP32 inside has Wi-Fi, Bluetooth and enough power for tiny AI models. Kids level up
                    without ever changing boards.
                </p>
            </div>
            <ol className="tb-levels">
                {LEVELS.map(level => (
                    <LevelCard
                        key={level.label}
                        {...level}
                    />
                ))}
            </ol>
        </div>
    </section>
);

export default RoomToGrow;
