import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';

import WebSerialStep from '../components/connection-modal/web-serial-step.jsx';
import WebSerialUnavailableStep from '../components/connection-modal/web-serial-unavailable-step.jsx';
import {getDeviceConnectBaud} from '../lib/web-serial/device-profiles';
import {isWebSerialSupported, SUPPORTED_BROWSERS} from '../lib/web-serial/supported-browsers';
import {normalizeWebSerialError} from '../lib/web-serial/errors';
import {requestAndOpenPort, closePort} from '../lib/web-serial/web-serial-port';

class WebSerialConnectStep extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleConnect'
        ]);
        this.state = {
            connecting: false,
            errorMessage: null
        };
        this._keepPort = false;
    }
    componentWillUnmount () {
        if (!this._keepPort && !this.props.keepPortOpen) {
            closePort();
        }
    }
    handleConnect () {
        this.setState({connecting: true, errorMessage: null});
        const baudRate = getDeviceConnectBaud(this.props.deviceId);
        requestAndOpenPort(baudRate)
            .then(({label}) => {
                this._keepPort = true;
                this.setState({connecting: false});
                this.props.onConnected(label);
            })
            .catch(err => {
                this.setState({
                    connecting: false,
                    errorMessage: normalizeWebSerialError(err)
                });
            });
    }
    render () {
        if (!isWebSerialSupported()) {
            return (
                <WebSerialUnavailableStep
                    onCancel={this.props.onCancel}
                    supportedBrowsers={SUPPORTED_BROWSERS}
                />
            );
        }
        return (
            <WebSerialStep
                connecting={this.state.connecting}
                errorMessage={this.state.errorMessage}
                onConnect={this.handleConnect}
            />
        );
    }
}

WebSerialConnectStep.propTypes = {
    deviceId: PropTypes.string,
    keepPortOpen: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onConnected: PropTypes.func.isRequired
};

export default WebSerialConnectStep;
