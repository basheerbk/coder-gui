import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import ConnectionModalComponent, {PHASES} from '../components/connection-modal/connection-modal.jsx';
import VM from 'openblock-vm';
import analytics from '../lib/analytics';
import {clarityEvent, setClarityTag, upgradeClaritySession} from '../lib/clarity';
import {connect} from 'react-redux';
import {closeConnectionModal} from '../reducers/modals';
import {setConnectionModalPeripheralName, setListAll, clearConnectionModalPeripheralName} from '../reducers/connection-modal';
import {isWebSerialUploadDevice} from '../lib/web-serial/device-profiles';
import {closePort, isConnected as isWebSerialConnected} from '../lib/web-serial/web-serial-port';

class ConnectionModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleScanning',
            'handleCancel',
            'handleConnected',
            'handleConnecting',
            'handleDisconnect',
            'handleError',
            'handleHelp',
            'handleWebSerialConnected'
        ]);
        const useWebSerial = isWebSerialUploadDevice(props.deviceId);
        this.state = {
            device: this.props.deviceData.find(device => device.deviceId === props.deviceId),
            phase: useWebSerial ?
                (isWebSerialConnected() ? PHASES.connected : PHASES.scanning) :
                (props.vm.getPeripheralIsConnected(props.deviceId) ?
                    PHASES.connected : PHASES.scanning),
            peripheralName: null,
            errorMessage: null,
            useWebSerial
        };
    }
    componentDidMount () {
        this.props.vm.on('PERIPHERAL_CONNECTED', this.handleConnected);
        this.props.vm.on('PERIPHERAL_REQUEST_ERROR', this.handleError);
    }
    componentDidUpdate (prevProps) {
        if (prevProps.deviceId !== this.props.deviceId) {
            const useWebSerial = isWebSerialUploadDevice(this.props.deviceId);
            if (useWebSerial || this.state.useWebSerial) {
                closePort();
                this.props.onClearConnected();
            }
            this.setState({
                device: this.props.deviceData.find(device => device.deviceId === this.props.deviceId),
                phase: useWebSerial ?
                    (isWebSerialConnected() ? PHASES.connected : PHASES.scanning) :
                    PHASES.scanning,
                peripheralName: null,
                errorMessage: null,
                useWebSerial
            });
        }
    }
    componentWillUnmount () {
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleConnected);
        this.props.vm.removeListener('PERIPHERAL_REQUEST_ERROR', this.handleError);
    }
    handleScanning () {
        this.setState({
            phase: PHASES.scanning
        });
    }
    handleConnecting (peripheralId, peripheralName) {
        if (this.props.isRealtimeMode) {
            this.props.vm.connectPeripheral(this.props.deviceId, peripheralId);
        } else {
            this.props.vm.connectPeripheral(this.props.deviceId, peripheralId, parseInt(this.props.baudrate, 10));
        }
        this.setState({
            phase: PHASES.connecting,
            peripheralName: peripheralName
        });
        analytics.event({
            category: 'devices',
            action: 'connecting',
            label: this.props.deviceId
        });
        setClarityTag('device', this.props.deviceId);
        clarityEvent('board_connecting');
    }
    handleDisconnect () {
        try {
            if (this.state.useWebSerial) {
                closePort();
                this.props.onClearConnected();
            } else {
                this.props.vm.disconnectPeripheral(this.props.deviceId);
            }
        } finally {
            this.props.onCancel();
        }
    }
    handleCancel () {
        try {
            if (this.state.useWebSerial) {
                // Keep port open after modal close if already connected.
            } else if (!this.props.vm.getPeripheralIsConnected(this.props.deviceId)) {
                this.props.vm.disconnectPeripheral(this.props.deviceId);
            }
        } finally {
            this.props.onCancel();
        }
    }
    handleWebSerialConnected (label) {
        this.setState({
            phase: PHASES.connected,
            peripheralName: label
        });
        setClarityTag('device', this.props.deviceId);
        clarityEvent('board_connected');
        upgradeClaritySession('board_connected');
        this.props.onConnected(label);
    }
    handleError (err) {
        // Assume errors that come in during scanning phase are the result of not
        // having scratch-link installed.
        if (this.state.phase === PHASES.scanning || this.state.phase === PHASES.unavailable) {
            this.setState({
                phase: PHASES.unavailable
            });
        } else {
            this.setState({
                phase: PHASES.error,
                errorMessage: err.message
            });
            analytics.event({
                category: 'devices',
                action: 'connecting error',
                label: this.props.deviceId
            });
            clarityEvent('board_connect_error');
        }
    }
    handleConnected () {
        this.setState({
            phase: PHASES.connected
        });
        analytics.event({
            category: 'devices',
            action: 'connected',
            label: this.props.deviceId
        });
        setClarityTag('device', this.props.deviceId);
        clarityEvent('board_connected');
        upgradeClaritySession('board_connected');
        this.props.onConnected(this.state.peripheralName);
    }
    handleHelp () {
        window.open(this.state.device.helpLink, '_blank');
        analytics.event({
            category: 'devices',
            action: 'device help',
            label: this.props.deviceId
        });
    }
    render () {
        return (
            <ConnectionModalComponent
                connectingMessage={this.state.device && this.state.device.connectingMessage}
                connectionIconURL={this.state.device && this.state.device.connectionIconURL}
                connectionSmallIconURL={this.state.device && this.state.device.connectionSmallIconURL}
                errorMessage={this.state.errorMessage}
                isSerialport={this.state.device && this.state.device.serialportRequired}
                isListAll={this.props.isListAll}
                connectionTipIconURL={this.state.device && this.state.device.connectionTipIconURL}
                deviceId={this.props.deviceId}
                name={this.state.device && this.state.device.name}
                phase={this.state.phase}
                title={this.props.deviceId}
                useAutoScan={this.state.device && this.state.device.useAutoScan}
                vm={this.props.vm}
                onCancel={this.handleCancel}
                onConnected={this.handleConnected}
                onConnecting={this.handleConnecting}
                onClickListAll={this.props.onClickListAll}
                onDisconnect={this.handleDisconnect}
                onHelp={this.handleHelp}
                onScanning={this.handleScanning}
                onWebSerialConnected={this.handleWebSerialConnected}
                useWebSerial={this.state.useWebSerial}
            />
        );
    }
}

ConnectionModal.propTypes = {
    baudrate: PropTypes.string.isRequired,
    deviceId: PropTypes.string.isRequired,
    deviceData: PropTypes.instanceOf(Array).isRequired,
    isRealtimeMode: PropTypes.bool,
    isListAll: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onClearConnected: PropTypes.func.isRequired,
    onConnected: PropTypes.func.isRequired,
    onClickListAll: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    baudrate: state.scratchGui.hardwareConsole.baudrate,
    deviceData: state.scratchGui.deviceData.deviceData,
    deviceId: state.scratchGui.device.deviceId,
    isRealtimeMode: state.scratchGui.programMode.isRealtimeMode,
    isListAll: state.scratchGui.connectionModal.isListAll
});

const mapDispatchToProps = dispatch => ({
    onCancel: () => {
        dispatch(closeConnectionModal());
    },
    onClearConnected: () => {
        dispatch(clearConnectionModalPeripheralName());
    },
    onConnected: peripheralName => {
        dispatch(setConnectionModalPeripheralName(peripheralName));
    },
    onClickListAll: state => {
        dispatch(setListAll(state));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ConnectionModal);
