import {KIT_DEVICE_ID, makeDeviceLibrary} from '../../src/lib/libraries/devices/index.jsx';

const listed = list => list.filter(device => device.hide !== true).map(device => device.deviceId);

describe('device library', () => {
    test('lists only the kit board', () => {
        expect(KIT_DEVICE_ID).toBe('makerEsp32_arduinoEsp32');
        expect(listed(makeDeviceLibrary())).toEqual([KIT_DEVICE_ID]);
    });

    test('keeps other boards loadable for old projects', () => {
        const ids = makeDeviceLibrary().map(device => device.deviceId);
        expect(ids).toEqual(expect.arrayContaining(['arduinoUno', 'makerUno_arduinoUno', 'arduinoEsp32']));
    });

    test('hides boards the desktop link adds', () => {
        const fromLink = [{deviceId: 'classroom_arduinoUno', name: 'Classroom Uno'}];
        const list = makeDeviceLibrary(fromLink);
        expect(list.some(device => device.deviceId === 'classroom_arduinoUno')).toBe(true);
        expect(listed(list)).toEqual([KIT_DEVICE_ID]);
    });
});
