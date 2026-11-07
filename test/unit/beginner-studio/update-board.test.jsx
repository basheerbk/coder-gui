import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import UpdateBoardDialog from '../../../src/beginner-studio/components/layout/UpdateBoardDialog.jsx';
import {StudioProvider} from '../../../src/beginner-studio/context/StudioContext.jsx';

let mockUpload;
jest.mock('../../../src/beginner-studio/context/UploadContext.jsx', () => ({useUpload: () => mockUpload}));

const memoryStorage = () => {
    const data = {};
    return {
        get length () {
            return Object.keys(data).length;
        },
        key: i => Object.keys(data)[i] || null,
        getItem: k => {
            const has = Object.prototype.hasOwnProperty.call(data, k);
            return has ? data[k] : null;
        },
        setItem: (k, v) => {
            data[k] = String(v);
        },
        removeItem: k => {
            delete data[k];
        }
    };
};

let root;
const onClose = jest.fn();

const render = state => {
    mockUpload = Object.assign({
        connected: true,
        supported: true,
        boardInfo: null,
        update: {phase: 'idle', message: '', progress: null},
        checkBoard: jest.fn(),
        updateBoard: jest.fn(),
        clearUpdate: jest.fn(),
        connectBoard: jest.fn()
    }, state);
    act(() => {
        ReactDOM.render(<StudioProvider user={null}><UpdateBoardDialog onClose={onClose} /></StudioProvider>, root);
    });
};
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label);
const click = el => act(() => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
});
const status = () => document.querySelector('[role="status"]').textContent;

beforeEach(() => {
    ['localStorage', 'sessionStorage'].forEach(name => {
        Object.defineProperty(window, name, {value: memoryStorage(), configurable: true});
    });
    onClose.mockClear();
    root = document.createElement('div');
    document.body.appendChild(root);
});

afterEach(() => {
    ReactDOM.unmountComponentAtNode(root);
    root.remove();
});

describe('Update board dialog', () => {
    test('a connected board is checked as soon as the dialog opens', () => {
        render({boardInfo: {lang: 'arduino'}});
        expect(mockUpload.checkBoard).toHaveBeenCalledTimes(1);
        expect(status()).toMatch(/runs an Arduino program/);
        click(button('Update board'));
        expect(mockUpload.updateBoard).toHaveBeenCalledTimes(1);
    });

    test('without a board it asks to connect first and does not check', () => {
        render({connected: false});
        expect(mockUpload.checkBoard).not.toHaveBeenCalled();
        expect(button('Update board')).toBeUndefined();
        click(button('Connect board'));
        expect(mockUpload.connectBoard).toHaveBeenCalledTimes(1);
    });

    test('while installing it shows progress and cannot be closed', () => {
        render({update: {phase: 'installing', message: 'MicroPython: Writing image 2/3…', progress: 40}});
        expect(status()).toMatch(/Putting the TinkerBit firmware on your board/);
        expect(button('Updating… 40%').disabled).toBe(true);
        expect(button('Close').disabled).toBe(true);
    });

    test('when done it says the board is ready', () => {
        render({update: {phase: 'done', message: '', progress: 100}, boardInfo: {lang: 'micropython', mpy: '1.24.1'}});
        expect(status()).toMatch(/Your board is ready/);
        expect(button('Update board')).toBeUndefined();
        click(button('Done'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('an error is shown in plain words', () => {
        render({update: {
            phase: 'error',
            message: 'The downloaded TinkerBit firmware is damaged. Reload the page, then press Update board again.',
            progress: null
        }});
        expect(status()).toMatch(/damaged/);
    });

    test('it tells TinkerBit firmware, stock MicroPython and an out-of-date firmware apart', () => {
        const fw = {lang: 'micropython', mpy: '1.24.1', fw: 'tinkerbit', ver: '0.1.0'};
        render({boardInfo: Object.assign({api: 1}, fw)});
        expect(status()).toMatch(/TinkerBit firmware is on this board and up to date/);
        render({boardInfo: Object.assign({api: 0}, fw)});
        expect(status()).toMatch(/older TinkerBit firmware/);
        render({boardInfo: {lang: 'micropython', mpy: '1.24.1', fw: 'stock', api: 0}});
        expect(status()).toMatch(/without the TinkerBit firmware.*Cloud/);
    });
});
