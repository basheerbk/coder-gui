import {isWebSerialUploadDevice} from '../lib/web-serial/device-profiles';

const SET_ACTIVE = 'scratch-gui/web-serial-upload/setActive';
const SET_PHASE = 'scratch-gui/web-serial-upload/setPhase';
const APPEND_LOG = 'scratch-gui/web-serial-upload/appendLog';
const CLEAR = 'scratch-gui/web-serial-upload/clear';

const PHASES = {
    idle: 'idle',
    uploading: 'uploading',
    success: 'success',
    error: 'error',
    timeout: 'timeout',
    aborted: 'aborted'
};

const initialState = {
    active: false,
    phase: PHASES.idle,
    text: '',
    progressMessage: ''
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_ACTIVE:
        return Object.assign({}, state, {active: action.active});
    case SET_PHASE:
        return Object.assign({}, state, {
            phase: action.phase,
            progressMessage: action.progressMessage || state.progressMessage
        });
    case APPEND_LOG:
        return Object.assign({}, state, {
            text: state.text + action.text
        });
    case CLEAR:
        return Object.assign({}, initialState);
    default:
        return state;
    }
};

const setWebSerialUploadActive = active => ({
    type: SET_ACTIVE,
    active
});

const setWebSerialUploadPhase = (phase, progressMessage = '') => ({
    type: SET_PHASE,
    phase,
    progressMessage
});

const appendWebSerialUploadLog = text => ({
    type: APPEND_LOG,
    text
});

const clearWebSerialUpload = () => ({
    type: CLEAR
});

export {
    reducer as default,
    initialState as webSerialUploadInitialState,
    PHASES as webSerialUploadPhases,
    setWebSerialUploadActive,
    setWebSerialUploadPhase,
    appendWebSerialUploadLog,
    clearWebSerialUpload
};
