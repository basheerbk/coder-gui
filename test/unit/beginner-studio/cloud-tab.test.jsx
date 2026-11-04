import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import {useStudio} from '../../../src/beginner-studio/context/StudioContext.jsx';
import {useUpload} from '../../../src/beginner-studio/context/UploadContext.jsx';
import BoardPanel from '../../../src/beginner-studio/components/cloud/BoardPanel.jsx';
import {panelControls, panelReadings} from '../../../src/beginner-studio/domain/cloudPanel';
import {moduleById} from '../../../src/beginner-studio/domain/modules';
import {templateById} from '../../../src/beginner-studio/domain/templates';
import {iotApi} from '../../../src/lib/iot-api';

jest.mock('../../../src/beginner-studio/context/StudioContext.jsx', () => ({useStudio: jest.fn()}));
jest.mock('../../../src/beginner-studio/context/UploadContext.jsx', () => ({useUpload: jest.fn()}));
jest.mock('../../../src/lib/iot-api', () => ({
    iotApi: {setControl: jest.fn()},
    errorText: err => `failed: ${err.code}`
}));

const K = new Proxy({}, {get: () => '#888888'});
const parking = templateById('cloud-parking');
const relays = templateById('cloud-relays');
const fan = templateById('cloud-fan');

describe('Cloud tab readings and controls', () => {
    test('readings use the part name and unit, with the latest value', () => {
        const ultra = parking.connections.map(c => moduleById(c.moduleId)).find(m => m && m.valueName === 'distance');
        const rows = panelReadings(parking.connections, parking.program, [{key: 'distance', value: 42, ts: 1000}]);
        expect(rows).toEqual([{key: 'distance', label: ultra.name, unit: 'cm', value: 42, ts: 1000}]);
        expect(panelReadings(parking.connections, parking.program, [])[0].value).toBeNull();
    });

    test('only the switches and sliders the program uses, with friendly names', () => {
        const controls = [{key: 'switch1', value: 1, version: 2}];
        const rows = panelControls(relays.program, controls);
        expect(rows.map(r => r.label)).toEqual(['Dashboard switch 1', 'Dashboard switch 2', 'Dashboard switch 3', 'Dashboard switch 4']);
        expect(rows[0].control).toBe(controls[0]);
        expect(rows[1].control).toBeNull();
        expect(panelControls(fan.program, [])).toEqual([{key: 'slider1', kind: 'slider', label: 'Dashboard slider 1', control: null}]);
    });
});

describe('Cloud tab board panel', () => {
    let root;
    let w;
    let applyControl;

    const render = (device, stage = 'idle', controls = []) => {
        useStudio.mockReturnValue({K, connections: relays.connections, program: relays.program});
        useUpload.mockReturnValue({
            cloudLive: {stage, detail: {device, latest: [], controls}, applyControl}
        });
        act(() => {
            ReactDOM.render(<BoardPanel w={w} />, root);
        });
    };
    const button = label => [...root.querySelectorAll('button')].find(b => b.textContent === label);
    const click = el => act(() => {
        el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    beforeEach(() => {
        applyControl = jest.fn();
        iotApi.setControl.mockReset();
        w = {cloud: {deviceId: 'd1', deviceName: 'Relays'}, goUpload: jest.fn(), goBoard: jest.fn(), enable: jest.fn(), busy: ''};
        root = document.createElement('div');
        document.body.appendChild(root);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(root);
        root.remove();
    });

    test('just went live: celebrates and shows the QR code', () => {
        render({id: 'd1', name: 'Relays', status: 'online', onlineSince: Date.now()}, 'live');
        expect(root.textContent).toContain('“Relays” is live!');
        expect(root.querySelector('[role="img"]').getAttribute('aria-label')).toContain('Relays');
        expect(root.querySelector('a[href="/iot/d/d1"]')).toBeTruthy();
    });

    test('offline board offers Upload again and a way back to setup', () => {
        render({id: 'd1', name: 'Relays', status: 'offline', lastSeen: Date.now() - (5 * 60000)});
        expect(root.textContent).toContain('Offline');
        expect(root.textContent).toContain('Last seen 5 min ago');
        click(button('Upload again'));
        expect(w.goUpload).toHaveBeenCalledTimes(1);
        click(button('Change board or WiFi'));
        expect(w.goBoard).toHaveBeenCalledTimes(1);
    });

    test('a switch sends the new value with its version and shows the answer', async () => {
        const sent = {key: 'switch1', value: 1, version: 4, ackedVersion: 3};
        iotApi.setControl.mockReturnValue(Promise.resolve({control: sent}));
        render({id: 'd1', name: 'Relays', status: 'online'}, 'idle', [{key: 'switch1', value: 0, version: 3, ackedVersion: 3}]);
        const toggle = root.querySelector('[role="switch"][aria-label="Dashboard switch 1"]');
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(root.textContent).toContain('board has it');
        click(toggle);
        await act(async () => {
            await Promise.resolve();
        });
        expect(iotApi.setControl).toHaveBeenCalledWith('d1', 'switch1', {value: 1, expectedVersion: 3});
        expect(applyControl).toHaveBeenCalledWith(sent);
    });

    test('a turned-off board offers to turn it back on', () => {
        render({id: 'd1', name: 'Relays', status: 'disabled', disabledReason: 'Too many messages'});
        expect(root.textContent).toContain('Too many messages');
        click(button('Turn it back on'));
        expect(w.enable).toHaveBeenCalledTimes(1);
    });
});
