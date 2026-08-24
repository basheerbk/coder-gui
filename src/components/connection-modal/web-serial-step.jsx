import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import Box from '../box/box.jsx';
import Dots from './dots.jsx';
import usbAndBluetoothIcon from './icons/usb-and-bluetooth.svg';

import styles from './connection-modal.css';

const WebSerialStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <div className={styles.scratchLinkHelp}>
                <div className={styles.scratchLinkHelpStep}>
                    <div className={styles.helpStepNumber}>{'1'}</div>
                    <div className={styles.helpStepImage}>
                        <img
                            className={styles.scratchLinkIcon}
                            src={usbAndBluetoothIcon}
                        />
                    </div>
                    <div className={styles.helpStepText}>
                        <FormattedMessage
                            defaultMessage="Plug your board into this computer with USB."
                            description="Web Serial connect step 1"
                            id="gui.connection.webserial.plugIn"
                        />
                    </div>
                </div>
                <div className={styles.scratchLinkHelpStep}>
                    <div className={styles.helpStepNumber}>{'2'}</div>
                    <div className={styles.helpStepImage}>
                        <img
                            className={styles.scratchLinkIcon}
                            src={usbAndBluetoothIcon}
                        />
                    </div>
                    <div className={styles.helpStepText}>
                        <FormattedMessage
                            defaultMessage="Click Connect and choose your board in the browser port picker."
                            description="Web Serial connect step 2"
                            id="gui.connection.webserial.choosePort"
                        />
                    </div>
                </div>
            </div>
            {props.errorMessage ? (
                <Box className={styles.instructions}>
                    {props.errorMessage}
                </Box>
            ) : null}
        </Box>
        <Box className={styles.bottomArea}>
            <Dots
                className={styles.bottomAreaItem}
                total={2}
                index={0}
            />
            <div className={classNames(styles.bottomAreaItem, styles.cornerButtons)}>
                <button
                    className={classNames(styles.redButton, styles.connectionButton)}
                    onClick={props.onConnect}
                    disabled={props.connecting}
                >
                    {props.connecting ? (
                        <FormattedMessage
                            defaultMessage="Connecting…"
                            description="Web Serial connecting"
                            id="gui.connection.webserial.connecting"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Connect"
                            description="Web Serial connect button"
                            id="gui.connection.webserial.connect"
                        />
                    )}
                </button>
            </div>
        </Box>
    </Box>
);

WebSerialStep.propTypes = {
    connecting: PropTypes.bool,
    errorMessage: PropTypes.string,
    onConnect: PropTypes.func.isRequired
};

export default WebSerialStep;
