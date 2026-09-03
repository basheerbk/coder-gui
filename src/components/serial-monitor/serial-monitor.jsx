import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import styles from './serial-monitor.css';
import classNames from 'classnames';

const messages = defineMessages({
    title: {
        defaultMessage: 'Serial Monitor',
        description: 'Title for serial monitor',
        id: 'gui.serialMonitor.title'
    },
    clearButton: {
        defaultMessage: 'Clear',
        description: 'Clear serial monitor output',
        id: 'gui.serialMonitor.clear'
    },
    sendButton: {
        defaultMessage: 'Send',
        description: 'Send data to serial port',
        id: 'gui.serialMonitor.send'
    },
    disconnectButton: {
        defaultMessage: 'Disconnect',
        description: 'Disconnect serial port',
        id: 'gui.serialMonitor.disconnect'
    },
    baudRate: {
        defaultMessage: 'Baud Rate:',
        description: 'Serial baud rate label',
        id: 'gui.serialMonitor.baudRate'
    },
    notConnected: {
        defaultMessage: 'Not connected to any device',
        description: 'Serial monitor not connected message',
        id: 'gui.serialMonitor.notConnected'
    }
});

const SerialMonitorComponent = props => (
    <div className={classNames(styles.serialMonitor, {[styles.hidden]: !props.visible})}>
        <div className={styles.header}>
            <div className={styles.title}>
                {props.intl.formatMessage(messages.title)}
                {props.portLabel && (
                    <span className={styles.portLabel}> - {props.portLabel}</span>
                )}
            </div>
            <div className={styles.controls}>
                <label className={styles.baudLabel}>
                    {props.intl.formatMessage(messages.baudRate)}
                    <select
                        className={styles.baudSelect}
                        value={props.baudRate}
                        onChange={props.onBaudRateChange}
                        disabled={!props.isConnected}
                    >
                        <option value="300">300</option>
                        <option value="1200">1200</option>
                        <option value="2400">2400</option>
                        <option value="4800">4800</option>
                        <option value="9600">9600</option>
                        <option value="14400">14400</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="57600">57600</option>
                        <option value="115200">115200</option>
                    </select>
                </label>
                <button
                    className={styles.clearButton}
                    onClick={props.onClear}
                >
                    {props.intl.formatMessage(messages.clearButton)}
                </button>
                {props.isConnected && (
                    <button
                        className={styles.disconnectButton}
                        onClick={props.onDisconnect}
                    >
                        {props.intl.formatMessage(messages.disconnectButton)}
                    </button>
                )}
            </div>
        </div>
        
        <div className={styles.outputArea}>
            {!props.isConnected ? (
                <div className={styles.notConnected}>
                    {props.intl.formatMessage(messages.notConnected)}
                </div>
            ) : (
                <pre className={styles.output} ref={props.outputRef}>
                    {props.output}
                </pre>
            )}
        </div>
        
        {props.isConnected && (
            <div className={styles.inputArea}>
                <input
                    className={styles.input}
                    type="text"
                    value={props.inputValue}
                    onChange={props.onInputChange}
                    onKeyPress={props.onInputKeyPress}
                    placeholder="Send message..."
                    disabled={!props.isConnected}
                />
                <button
                    className={styles.sendButton}
                    onClick={props.onSend}
                    disabled={!props.isConnected || !props.inputValue}
                >
                    {props.intl.formatMessage(messages.sendButton)}
                </button>
            </div>
        )}
    </div>
);

SerialMonitorComponent.propTypes = {
    intl: intlShape.isRequired,
    visible: PropTypes.bool,
    isConnected: PropTypes.bool,
    portLabel: PropTypes.string,
    baudRate: PropTypes.number,
    output: PropTypes.string,
    inputValue: PropTypes.string,
    outputRef: PropTypes.object,
    onBaudRateChange: PropTypes.func,
    onClear: PropTypes.func,
    onDisconnect: PropTypes.func,
    onInputChange: PropTypes.func,
    onInputKeyPress: PropTypes.func,
    onSend: PropTypes.func
};

SerialMonitorComponent.defaultProps = {
    visible: false,
    isConnected: false,
    baudRate: 9600,
    output: '',
    inputValue: ''
};

export default injectIntl(SerialMonitorComponent);
