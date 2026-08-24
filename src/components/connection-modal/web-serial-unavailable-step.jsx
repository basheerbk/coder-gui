import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import Box from '../box/box.jsx';
import Dots from './dots.jsx';

import styles from './connection-modal.css';

const WebSerialUnavailableStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={styles.instructions}>
                <FormattedMessage
                    defaultMessage="Connect and Upload need Web Serial in Chrome or Edge on a desktop computer."
                    description="Web Serial unsupported browser message"
                    id="gui.connection.webserial.unsupported"
                />
            </Box>
            <Box className={styles.instructions}>
                <strong>
                    <FormattedMessage
                        defaultMessage="Works"
                        description="Supported browsers heading"
                        id="gui.connection.webserial.works"
                    />
                </strong>
                <ul>
                    {props.supportedBrowsers.works.map(item => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
                <strong>
                    <FormattedMessage
                        defaultMessage="Does not work"
                        description="Unsupported browsers heading"
                        id="gui.connection.webserial.notWorks"
                    />
                </strong>
                <ul>
                    {props.supportedBrowsers.notWorks.map(item => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots
                error
                className={styles.bottomAreaItem}
                total={2}
                index={1}
            />
            <button
                className={styles.connectionButton}
                onClick={props.onCancel}
            >
                <FormattedMessage
                    defaultMessage="Close"
                    description="Close unsupported browser dialog"
                    id="gui.connection.webserial.close"
                />
            </button>
        </Box>
    </Box>
);

WebSerialUnavailableStep.propTypes = {
    onCancel: PropTypes.func.isRequired,
    supportedBrowsers: PropTypes.shape({
        works: PropTypes.arrayOf(PropTypes.string),
        notWorks: PropTypes.arrayOf(PropTypes.string)
    }).isRequired
};

export default WebSerialUnavailableStep;
