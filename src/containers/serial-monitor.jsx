import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import SerialMonitorComponent from '../components/serial-monitor/serial-monitor.jsx';
import {connect} from 'react-redux';
import {
    startSerialMonitor,
    stopSerialMonitor,
    sendSerialData,
    isSerialMonitoring
} from '../lib/web-serial/serial-monitor';
import {isConnected as isWebSerialConnected, getPortLabel} from '../lib/web-serial/web-serial-port';

class SerialMonitor extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleBaudRateChange',
            'handleClear',
            'handleDisconnect',
            'handleInputChange',
            'handleInputKeyPress',
            'handleSend',
            'handleSerialOutput',
            'scrollToBottom'
        ]);

        this.state = {
            baudRate: 9600,
            output: '',
            inputValue: '',
            isMonitoring: false
        };

        this.outputRef = React.createRef();
    }

    componentDidMount () {
        // Auto-start monitor if connected
        if (this.props.isConnected && !this.state.isMonitoring) {
            this.startMonitoring();
        }
    }

    componentDidUpdate (prevProps) {
        // Start monitoring when device connects
        if (!prevProps.isConnected && this.props.isConnected && !this.state.isMonitoring) {
            this.startMonitoring();
        }

        // Stop monitoring when device disconnects
        if (prevProps.isConnected && !this.props.isConnected && this.state.isMonitoring) {
            this.stopMonitoring();
        }
    }

    componentWillUnmount () {
        if (this.state.isMonitoring) {
            stopSerialMonitor();
        }
    }

    async startMonitoring () {
        try {
            await startSerialMonitor(this.state.baudRate, this.handleSerialOutput);
            this.setState({isMonitoring: true});
        } catch (err) {
            console.error('Failed to start serial monitor:', err);
            this.setState({
                output: this.state.output + `\n[Error starting monitor: ${err.message}]\n`
            });
        }
    }

    async stopMonitoring () {
        try {
            await stopSerialMonitor();
            this.setState({isMonitoring: false});
        } catch (err) {
            console.error('Failed to stop serial monitor:', err);
        }
    }

    handleSerialOutput (text) {
        this.setState(prevState => ({
            output: prevState.output + text
        }), this.scrollToBottom);
    }

    scrollToBottom () {
        if (this.outputRef.current) {
            this.outputRef.current.scrollTop = this.outputRef.current.scrollHeight;
        }
    }

    async handleBaudRateChange (e) {
        const baudRate = parseInt(e.target.value, 10);
        this.setState({baudRate});

        // Restart monitor with new baud rate if currently monitoring
        if (this.state.isMonitoring) {
            await this.stopMonitoring();
            await this.startMonitoring();
        }
    }

    handleClear () {
        this.setState({output: ''});
    }

    async handleDisconnect () {
        await this.stopMonitoring();
        // Note: We don't close the port here - let the connection modal handle that
    }

    handleInputChange (e) {
        this.setState({inputValue: e.target.value});
    }

    async handleInputKeyPress (e) {
        if (e.key === 'Enter' && this.state.inputValue) {
            await this.handleSend();
        }
    }

    async handleSend () {
        if (!this.state.inputValue) return;

        try {
            await sendSerialData(this.state.inputValue, true);
            // Echo sent data in output
            this.setState(prevState => ({
                output: prevState.output + `> ${prevState.inputValue}\n`,
                inputValue: ''
            }), this.scrollToBottom);
        } catch (err) {
            console.error('Failed to send serial data:', err);
            this.setState(prevState => ({
                output: prevState.output + `\n[Error sending: ${err.message}]\n`
            }), this.scrollToBottom);
        }
    }

    render () {
        return (
            <SerialMonitorComponent
                visible={this.props.visible}
                isConnected={this.props.isConnected && this.state.isMonitoring}
                portLabel={this.props.portLabel}
                baudRate={this.state.baudRate}
                output={this.state.output}
                inputValue={this.state.inputValue}
                outputRef={this.outputRef}
                onBaudRateChange={this.handleBaudRateChange}
                onClear={this.handleClear}
                onDisconnect={this.handleDisconnect}
                onInputChange={this.handleInputChange}
                onInputKeyPress={this.handleInputKeyPress}
                onSend={this.handleSend}
            />
        );
    }
}

SerialMonitor.propTypes = {
    visible: PropTypes.bool,
    isConnected: PropTypes.bool,
    portLabel: PropTypes.string
};

const mapStateToProps = state => {
    const isConnected = isWebSerialConnected();
    return {
        isConnected,
        portLabel: isConnected ? getPortLabel() : null
    };
};

export default connect(
    mapStateToProps
)(SerialMonitor);
