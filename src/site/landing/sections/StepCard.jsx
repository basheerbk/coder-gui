import PropTypes from 'prop-types';
import React from 'react';

const StepCard = ({art: Art, highlight, number, tag, text, title, footnote}) => (
    <li className={`tb-step${highlight ? ' tb-step--highlight' : ''}`}>
        <div className="tb-step-head">
            <span className="tb-step-number">{number}</span>
            <span className="tb-step-tag">{tag}</span>
            <span
                className="tb-step-rule"
                aria-hidden="true"
            />
            <span
                className="tb-step-dot"
                aria-hidden="true"
            />
        </div>
        <div className={`tb-step-art${highlight ? '' : ' grid-light'}`}>
            <Art />
        </div>
        <h3 className="tb-step-title">{title}</h3>
        <p className="tb-step-text">{text}</p>
        <p className="tb-step-foot">{footnote}</p>
    </li>
);

StepCard.propTypes = {
    art: PropTypes.func.isRequired,
    footnote: PropTypes.string.isRequired,
    highlight: PropTypes.bool,
    number: PropTypes.string.isRequired,
    tag: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

StepCard.defaultProps = {
    highlight: false
};

export default StepCard;
