import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'openblock-vm';
import {connect} from 'react-redux';
import {compose} from 'redux';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import analytics from '../lib/analytics';
import {clarityEvent, setClarityTag, upgradeClaritySession} from '../lib/clarity';
import {setDeviceData} from '../reducers/device-data';
import {installDeviceExtensions} from '../lib/device-extensions/install-device-extensions';

import {makeDeviceLibrary} from '../lib/libraries/devices/index.jsx';

import LibraryComponent from '../components/library/library.jsx';
import deviceIcon from '../components/action-menu/icon--sprite.svg';

const messages = defineMessages({
    deviceTitle: {
        defaultMessage: 'Choose an Device',
        description: 'Heading for the device library',
        id: 'gui.deviceLibrary.chooseADevice'
    },
    deviceUrl: {
        defaultMessage: 'Enter the URL of the device',
        description: 'Prompt for unoffical device url',
        id: 'gui.deviceLibrary.deviceUrl'
    },
    arduinoTag: {
        defaultMessage: 'Arduino',
        description: 'Arduino tag to filter all arduino devices.',
        id: 'gui.deviceLibrary.arduinoTag'
    },
    microPythonTag: {
        defaultMessage: 'MicroPython',
        description: 'Micro python tag to filter all micro python devices.',
        id: 'gui.deviceLibrary.microPythonTag'
    },
    kitTag: {
        defaultMessage: 'Kit',
        description: 'Kit tag to filter all kit devices.',
        id: 'gui.deviceLibrary.kitTag'
    }
});

const ARDUINO_TAG = {tag: 'Arduino', intlLabel: messages.arduinoTag};
const MICROPYTHON_TAG = {tag: 'MicroPython', intlLabel: messages.microPythonTag};
const KIT_TAG = {tag: 'Kit', intlLabel: messages.kitTag};
const tagListPrefix = [ARDUINO_TAG, MICROPYTHON_TAG, KIT_TAG];

class DeviceLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect',
            'requestLoadDevice'
        ]);
    }
    componentDidMount () {
        // Keep built-in boards if Link/resource server is unavailable.
        this.props.vm.extensionManager.getDeviceList().then(data => {
            this.props.onSetDeviceData(makeDeviceLibrary(data || null));
        })
            .catch(() => {
                this.props.onSetDeviceData(makeDeviceLibrary());
            });
    }

    requestLoadDevice (device) {
        const id = device.deviceId;
        const deviceExtensions = device.deviceExtensions;

        if (id && !device.disabled) {
            if (this.props.vm.extensionManager.isDeviceLoaded(id)) {
                this.props.onDeviceSelected(id);
                setClarityTag('device', id);
                clarityEvent('board_selected');
            } else {
                this.props.vm.extensionManager.loadDeviceURL(device).then(() => {
                    installDeviceExtensions(this.props.vm, deviceExtensions)
                        .catch(err =>
                            console.error(err) // eslint-disable-line no-console
                        );
                    this.props.onDeviceSelected(id);
                    setClarityTag('device', id);
                    clarityEvent('board_selected');
                    upgradeClaritySession('board_selected');
                    analytics.event({
                        category: 'devices',
                        action: 'select device',
                        label: id
                    });
                })
                    .catch(err =>
                        console.error(err) // eslint-disable-line no-console
                    );
            }
        }
    }

    handleItemSelect (item) {
        this.requestLoadDevice(item);
        this.props.onRequestClose();
    }

    render () {
        const deviceLibraryThumbnailData = this.props.deviceData.map(device => ({
            rawURL: device.iconURL || deviceIcon,
            ...device
        }));

        return (
            <LibraryComponent
                data={deviceLibraryThumbnailData}
                filterable
                tags={tagListPrefix}
                id="deviceLibrary"
                title={this.props.intl.formatMessage(messages.deviceTitle)}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

DeviceLibrary.propTypes = {
    deviceData: PropTypes.instanceOf(Array).isRequired,
    intl: intlShape.isRequired,
    onDeviceSelected: PropTypes.func,
    onRequestClose: PropTypes.func,
    onSetDeviceData: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

const mapStateToProps = state => ({
    deviceData: state.scratchGui.deviceData.deviceData
});

const mapDispatchToProps = dispatch => ({
    onSetDeviceData: data => dispatch(setDeviceData(data))
});

export default compose(
    injectIntl,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(DeviceLibrary);
