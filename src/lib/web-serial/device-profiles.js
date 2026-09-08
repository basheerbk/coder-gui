/**
 * Boards that use browser Web Serial for Connect/Upload instead of the desktop link.
 * Inherited boards use id like makerUno_arduinoUno — resolve to the base id after '_'.
 */
const WEB_SERIAL_UPLOAD_DEVICES = new Set([
    'arduinoUno',
    'arduinoEsp32'
]);

const DEVICE_PROFILES = {
    arduinoUno: {
        fqbn: 'arduino:avr:uno',
        protocol: 'stk500',
        monitorBaud: 9600,
        connectBaud: 115200
    },
    arduinoEsp32: {
        fqbn: 'esp32:esp32:esp32',
        protocol: 'esptool',
        monitorBaud: 115200,
        connectBaud: 115200
    },
    arduinoEsp32S3: {
        fqbn: 'esp32:esp32:esp32s3',
        protocol: 'esptool',
        monitorBaud: 115200,
        connectBaud: 115200
    }
};

const resolveBaseDeviceId = deviceId => {
    if (!deviceId || typeof deviceId !== 'string') {
        return deviceId;
    }
    if (deviceId.indexOf('_') !== -1) {
        return deviceId.split('_')[1];
    }
    return deviceId;
};

const isWebSerialUploadDevice = deviceId =>
    WEB_SERIAL_UPLOAD_DEVICES.has(resolveBaseDeviceId(deviceId));

const getDeviceProfile = deviceId =>
    DEVICE_PROFILES[resolveBaseDeviceId(deviceId)] || DEVICE_PROFILES.arduinoUno;

const getDeviceFqbn = deviceId => getDeviceProfile(deviceId).fqbn;

const getDeviceProtocol = deviceId => getDeviceProfile(deviceId).protocol;

const getDeviceMonitorBaud = deviceId => getDeviceProfile(deviceId).monitorBaud;

const getDeviceConnectBaud = deviceId => getDeviceProfile(deviceId).connectBaud;

export {
    WEB_SERIAL_UPLOAD_DEVICES,
    DEVICE_PROFILES,
    resolveBaseDeviceId,
    isWebSerialUploadDevice,
    getDeviceProfile,
    getDeviceFqbn,
    getDeviceProtocol,
    getDeviceMonitorBaud,
    getDeviceConnectBaud
};
