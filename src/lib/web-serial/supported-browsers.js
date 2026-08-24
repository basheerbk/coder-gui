const isWebSerialSupported = () =>
    typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined';

const SUPPORTED_BROWSERS = {
    works: [
        'Google Chrome (Windows, macOS, Linux)',
        'Microsoft Edge (Windows, macOS, Linux)',
        'Brave and other Chromium desktop browsers'
    ],
    notWorks: [
        'Mozilla Firefox',
        'Apple Safari (Mac)',
        'iPhone / iPad (any browser)',
        'Most phones and tablets'
    ],
    alsoNeeded: [
        'Open the IDE over HTTPS or localhost',
        'Plug the Arduino into this computer with USB'
    ]
};

export {
    isWebSerialSupported,
    SUPPORTED_BROWSERS
};
