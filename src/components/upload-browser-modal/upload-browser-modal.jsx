import PropTypes from 'prop-types';
import React from 'react';
import ReactModal from 'react-modal';
import {FormattedMessage} from 'react-intl';

import Box from '../box/box.jsx';
import styles from './upload-browser-modal.css';
import unhappyBrowser from '../browser-modal/unsupported-browser.svg';

const UploadBrowserModal = props => (
    <ReactModal
        isOpen={props.isOpen}
        className={styles.modalContent}
        contentLabel="Code Upload browser support"
        overlayClassName={styles.modalOverlay}
        onRequestClose={props.onClose}
    >
        <div dir={props.isRtl ? 'rtl' : 'ltr'}>
            <Box className={styles.illustration}>
                <img
                    alt=""
                    src={unhappyBrowser}
                />
            </Box>
            <Box className={styles.body}>
                <h2>
                    <FormattedMessage
                        defaultMessage="Code Upload needs Chrome or Edge"
                        description="Title for Code Upload unsupported browser modal"
                        id="gui.uploadBrowserModal.title"
                    />
                </h2>
                <p className={styles.lead}>
                    <FormattedMessage
                        defaultMessage="You can still drag blocks and explore the IDE here. Sending a program to a real board over USB only works in supported desktop browsers."
                        description="Lead text for Code Upload unsupported browser modal"
                        id="gui.uploadBrowserModal.lead"
                    />
                </p>
                <div className={styles.columns}>
                    <div className={styles.column}>
                        <h3>
                            <FormattedMessage
                                defaultMessage="Upload works here"
                                description="Heading for browsers that support Code Upload"
                                id="gui.uploadBrowserModal.works"
                            />
                        </h3>
                        <ul>
                            {props.supportedBrowsers.works.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.column}>
                        <h3>
                            <FormattedMessage
                                defaultMessage="Upload won’t work here"
                                description="Heading for browsers that do not support Code Upload"
                                id="gui.uploadBrowserModal.notWorks"
                            />
                        </h3>
                        <ul>
                            {props.supportedBrowsers.notWorks.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                <p className={styles.note}>
                    <FormattedMessage
                        defaultMessage="Also needed: open the IDE over HTTPS (or localhost) and plug the board into this computer with USB."
                        description="Extra requirements note for Code Upload"
                        id="gui.uploadBrowserModal.alsoNeeded"
                    />
                </p>
                <Box className={styles.buttonRow}>
                    <button
                        className={styles.gotIt}
                        type="button"
                        onClick={props.onClose}
                    >
                        <FormattedMessage
                            defaultMessage="Got it"
                            description="Dismiss Code Upload browser modal"
                            id="gui.uploadBrowserModal.gotIt"
                        />
                    </button>
                </Box>
            </Box>
        </div>
    </ReactModal>
);

UploadBrowserModal.propTypes = {
    isOpen: PropTypes.bool,
    isRtl: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    supportedBrowsers: PropTypes.shape({
        works: PropTypes.arrayOf(PropTypes.string).isRequired,
        notWorks: PropTypes.arrayOf(PropTypes.string).isRequired
    }).isRequired
};

UploadBrowserModal.defaultProps = {
    isOpen: false,
    isRtl: false
};

export default UploadBrowserModal;
