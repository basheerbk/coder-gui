import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';

import {connect} from 'react-redux';
import {compose} from 'redux';
import {injectIntl} from 'react-intl';

import VM from 'openblock-vm';

import {setStageSize} from '../reducers/stage-size';
import {STAGE_SIZE_MODES, STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import {openUploadProgress} from '../reducers/modals';
import {showAlertWithTimeout} from '../reducers/alerts';
import {
    appendWebSerialUploadLog,
    clearWebSerialUpload,
    setWebSerialUploadActive,
    setWebSerialUploadPhase,
    webSerialUploadPhases
} from '../reducers/web-serial-upload';
import {isWebSerialUploadDevice} from '../lib/web-serial/device-profiles';
import {isConnected as isWebSerialConnected} from '../lib/web-serial/web-serial-port';
import {isUploadInProgress} from '../lib/web-serial/upload-state';
import {uploadSketchWebSerial} from '../lib/web-serial/upload-pipeline';

import HardwareHeaderComponent from '../components/hardware-header/hardware-header.jsx';

class HardwareHeader extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleUpload',
            'handleWebSerialUpload'
        ]);
    }

    handleWebSerialUpload () {
        this.props.onClearWebSerialUpload();
        this.props.onSetWebSerialUploadActive(true);
        this.props.onSetWebSerialUploadPhase(webSerialUploadPhases.uploading, 'Starting upload…');
        this.props.onOpenUploadProgress();

        uploadSketchWebSerial(
            this.props.deviceId,
            this.props.codeEditorValue,
            (message, pct) => {
                this.props.onSetWebSerialUploadPhase(webSerialUploadPhases.uploading, `${message} (${pct}%)`);
            },
            text => {
                this.props.onAppendWebSerialUploadLog(text);
            }
        )
            .then(() => {
                this.props.onSetWebSerialUploadPhase(webSerialUploadPhases.success, 'Upload complete');
            })
            .catch(err => {
                this.props.onAppendWebSerialUploadLog(`${err.message}\r\n`);
                if (err.log) {
                    this.props.onAppendWebSerialUploadLog(`${err.log}\r\n`);
                }
                this.props.onSetWebSerialUploadPhase(webSerialUploadPhases.error, err.message);
            });
    }

    handleUpload () {
        if (isUploadInProgress()) {
            return;
        }

        const connected = isWebSerialUploadDevice(this.props.deviceId) ?
            (isWebSerialConnected() || Boolean(this.props.peripheralName)) :
            Boolean(this.props.peripheralName);

        if (!connected) {
            this.props.onNoPeripheralIsConnected();
            return;
        }

        const blocklyBlockCanvas = document.querySelector('.blocklyWorkspace .blocklyBlockCanvas');
        if (!blocklyBlockCanvas || blocklyBlockCanvas.childNodes.length === 0) {
            this.props.onWorkspaceIsEmpty();
            return;
        }

        const code = (this.props.codeEditorValue || '').trim();
        if (isWebSerialUploadDevice(this.props.deviceId) && !code) {
            this.props.onWorkspaceIsEmpty();
            return;
        }

        if (isWebSerialUploadDevice(this.props.deviceId)) {
            this.handleWebSerialUpload();
        } else {
            this.props.vm.uploadToPeripheral(this.props.deviceId, this.props.codeEditorValue);
            this.props.onOpenUploadProgress();
        }
    }

    render () {
        const {
            ...props
        } = this.props;
        return (
            <HardwareHeaderComponent
                onUpload={this.handleUpload}
                {...props}
            />
        );
    }
}

HardwareHeader.propTypes = {
    codeEditorValue: PropTypes.string,
    deviceId: PropTypes.string,
    onAppendWebSerialUploadLog: PropTypes.func.isRequired,
    onClearWebSerialUpload: PropTypes.func.isRequired,
    onNoPeripheralIsConnected: PropTypes.func.isRequired,
    onOpenUploadProgress: PropTypes.func,
    onSetWebSerialUploadActive: PropTypes.func.isRequired,
    onSetWebSerialUploadPhase: PropTypes.func.isRequired,
    onWorkspaceIsEmpty: PropTypes.func.isRequired,
    peripheralName: PropTypes.string,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    codeEditorValue: state.scratchGui.code.codeEditorValue,
    deviceId: state.scratchGui.device.deviceId,
    peripheralName: state.scratchGui.connectionModal.peripheralName
});

const mapDispatchToProps = dispatch => ({
    onAppendWebSerialUploadLog: text => dispatch(appendWebSerialUploadLog(text)),
    onClearWebSerialUpload: () => dispatch(clearWebSerialUpload()),
    onNoPeripheralIsConnected: () => showAlertWithTimeout(dispatch, 'connectAPeripheralFirst'),
    onSetStageLarge: () => dispatch(setStageSize(STAGE_SIZE_MODES.large)),
    onSetStageSmall: () => dispatch(setStageSize(STAGE_SIZE_MODES.small)),
    onSetStageHide: () => dispatch(setStageSize(STAGE_SIZE_MODES.hide)),
    onOpenUploadProgress: () => dispatch(openUploadProgress()),
    onSetWebSerialUploadActive: active => dispatch(setWebSerialUploadActive(active)),
    onSetWebSerialUploadPhase: (phase, progressMessage) =>
        dispatch(setWebSerialUploadPhase(phase, progressMessage)),
    onWorkspaceIsEmpty: () => showAlertWithTimeout(dispatch, 'workspaceIsEmpty')
});

export default compose(
    injectIntl,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(HardwareHeader);
