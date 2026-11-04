import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import {useUpload} from '../../../src/beginner-studio/context/UploadContext.jsx';
import LiveStep from '../../../src/beginner-studio/components/cloud/LiveStep.jsx';
import {initialProgress, reduceProgress} from '../../../src/beginner-studio/domain/cloudProgress';

jest.mock('../../../src/beginner-studio/context/StudioContext.jsx', () => ({
    useStudio: () => ({K: new Proxy({}, {get: () => '#888888'})})
}));
jest.mock('../../../src/beginner-studio/context/UploadContext.jsx', () => ({useUpload: jest.fn()}));

let root;
let w;

const progressAfter = types => types.reduce((p, type) => reduceProgress(p, {type}), initialProgress());

const render = cloudLive => {
    useUpload.mockReturnValue({cloudLive});
    act(() => {
        ReactDOM.render(<LiveStep w={w} />, root);
    });
};
const items = () => [...root.querySelectorAll('li')].map(li => li.getAttribute('aria-label'));
const button = label => [...root.querySelectorAll('button')].find(b => b.textContent === label);
const click = el => act(() => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
});

beforeEach(() => {
    w = {
        wifi: {ssid: 'HomeWiFi'},
        boardName: 'Garden',
        deviceId: 'd1',
        fixWifi: jest.fn(),
        newKeyAndUpload: jest.fn(),
        goUpload: jest.fn(),
        goBoard: jest.fn(),
        close: jest.fn()
    };
    root = document.createElement('div');
    document.body.appendChild(root);
});

afterEach(() => {
    ReactDOM.unmountComponentAtNode(root);
    root.remove();
});

describe('Cloud going-live checklist', () => {
    test('ticks off WiFi and shows Cloud in progress', () => {
        render({stage: 'waiting', progress: progressAfter(['wifi_joining', 'wifi_ok', 'cloud_connecting']), device: null});
        expect(items()).toEqual([
            'Program is on the board: done',
            'Join the WiFi “HomeWiFi”: done',
            'Connect to TinkerBit Cloud: in progress',
            'Show up on your dashboard: waiting'
        ]);
    });

    test('a wrong WiFi password offers Change WiFi', () => {
        render({stage: 'waiting', progress: progressAfter(['wifi_joining', 'wifi_password']), device: null});
        expect(items()[1]).toBe('Join the WiFi “HomeWiFi”: needs help');
        expect(root.textContent).toContain('The WiFi password looks wrong');
        click(button('Change WiFi'));
        expect(w.fixWifi).toHaveBeenCalledTimes(1);
    });

    test('a rejected key offers a new key', () => {
        render({stage: 'waiting', progress: progressAfter(['wifi_ok', 'cloud_connecting', 'cloud_rejected']), device: null});
        click(button('Make a new key'));
        expect(w.newKeyAndUpload).toHaveBeenCalledTimes(1);
    });

    test('going live shows the QR code and dashboard link', () => {
        render({stage: 'live', progress: progressAfter(['server_online']), device: {id: 'd1', status: 'online'}});
        expect(root.textContent).toContain('“Garden” is live!');
        expect(root.querySelector('[role="img"]').getAttribute('aria-label')).toContain('Garden');
        expect(root.querySelector('a').getAttribute('href')).toBe('/iot/d/d1');
    });

    test('without an upload it shows the board status and a way back to setup', () => {
        render({stage: 'idle', progress: initialProgress(), device: {id: 'd1', status: 'offline'}});
        expect(root.textContent).toContain('“Garden” is not online right now');
        expect(root.querySelector('[role="img"]')).toBeNull();
        click(button('Change board or WiFi'));
        expect(w.goBoard).toHaveBeenCalledTimes(1);
    });
});
