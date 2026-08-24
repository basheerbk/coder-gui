/**
 * Single-flight guard for Web Serial uploads (ignore double-clicks).
 */
let uploadInProgress = false;
let abortRequested = false;

const beginUpload = () => {
    if (uploadInProgress) {
        return false;
    }
    uploadInProgress = true;
    abortRequested = false;
    return true;
};

const endUpload = () => {
    uploadInProgress = false;
    abortRequested = false;
};

const requestAbort = () => {
    abortRequested = true;
};

const isAbortRequested = () => abortRequested;

const isUploadInProgress = () => uploadInProgress;

export {
    beginUpload,
    endUpload,
    requestAbort,
    isAbortRequested,
    isUploadInProgress
};
