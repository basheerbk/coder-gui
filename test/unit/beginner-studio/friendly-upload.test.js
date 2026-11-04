import {BOOT_TIP, friendlyUpload} from '../../../src/beginner-studio/domain/friendlyUpload';
import {normalizeWebSerialError} from '../../../src/lib/web-serial/errors';

const base = {phase: 'idle', message: '', connected: false, supported: true};
const at = (phase, message) => friendlyUpload(Object.assign({}, base, {phase, message}));

describe('friendlyUpload', () => {
    test('progress steps become plain words', () => {
        expect(at('uploading', 'Compiling on server…').text).toBe('Getting your program ready…');
        expect(at('uploading', 'Opening bootloader (classic)…').text).toBe('Waking up your board…');
        expect(at('uploading', 'Flashing ESP32…').text).toBe('Sending to your board…');
        expect(at('uploading', 'Hold BOOT on the board now…').text).toBe('Hold the BOOT button on the board now…');
    });

    test('success and idle', () => {
        expect(at('success', 'Upload complete').tone).toBe('ok');
        expect(friendlyUpload(Object.assign({}, base, {connected: true})).text).toBe('Board connected');
    });

    test('known errors map to short advice without the tip spam', () => {
        const busy = at('error', normalizeWebSerialError(new Error('Failed to open serial port')));
        expect(busy.text).toMatch(/Close other apps/);
        expect(busy.tip).toBe('');

        const noPort = at('error', 'No port selected by the user.');
        expect(noPort.text).toBe('Pick your board in the list that pops up.');
        expect(noPort.tip).toBe('');

        const boot = at('error', normalizeWebSerialError(new Error('Failed to connect with the device')));
        expect(boot.text).toMatch(/Hold the BOOT button/);
        expect(boot.tip).not.toBe('');
    });

    test('a compile-server timeout is not blamed on the BOOT button', () => {
        const msg = normalizeWebSerialError(new Error('Compile server timed out. Try a smaller sketch or try again.'));
        expect(at('error', msg).text).toMatch(/Cannot reach TinkerBit/);
    });

    test('unknown errors get the generic message and the BOOT tip', () => {
        const r = at('error', 'esptool exploded 0x42');
        expect(r.text).toBe('Something went wrong. Check the USB cable and try again.');
        expect(r.tip).toBe(BOOT_TIP);
    });

    test('unsupported browser', () => {
        expect(friendlyUpload(Object.assign({}, base, {supported: false})).text).toMatch(/Chrome or Edge/);
    });
});
