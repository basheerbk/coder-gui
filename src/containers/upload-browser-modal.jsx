import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';

import UploadBrowserModalComponent from '../components/upload-browser-modal/upload-browser-modal.jsx';
import {isWebSerialSupported, SUPPORTED_BROWSERS} from '../lib/web-serial/supported-browsers';

const SESSION_KEY = 'tinkerbit-upload-browser-modal-dismissed';

class UploadBrowserModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClose'
        ]);

        let dismissed = false;
        try {
            dismissed = sessionStorage.getItem(SESSION_KEY) === '1';
        } catch (err) {
            dismissed = false;
        }

        this.state = {
            isOpen: !isWebSerialSupported() && !dismissed
        };
    }
    handleClose () {
        try {
            sessionStorage.setItem(SESSION_KEY, '1');
        } catch (err) {
            // Ignore storage failures; still close the modal.
        }
        this.setState({isOpen: false});
    }
    render () {
        return (
            <UploadBrowserModalComponent
                isOpen={this.state.isOpen}
                isRtl={this.props.isRtl}
                supportedBrowsers={SUPPORTED_BROWSERS}
                onClose={this.handleClose}
            />
        );
    }
}

UploadBrowserModal.propTypes = {
    isRtl: PropTypes.bool
};

export default UploadBrowserModal;
