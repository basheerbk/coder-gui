import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';
import {TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder} from 'util';

import useAiRecorder from '../../../src/beginner-studio/hooks/useAiRecorder';

let mockListener = null;
jest.mock('../../../src/lib/web-serial/serial-monitor', () => ({
    MONITOR_STOP: 'monitor-stop',
    webSerialMonitorEvents: {addEventListener: jest.fn(), removeEventListener: jest.fn()},
    addSerialDataListener: jest.fn(fn => {
        mockListener = fn;
        return () => {
            mockListener = null;
        };
    }),
    isSerialMonitoring: jest.fn(() => false),
    startSerialMonitor: jest.fn(() => Promise.resolve())
}));
jest.mock('../../../src/lib/web-serial/upload-state', () => ({isUploadInProgress: () => false}));

if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = NodeTextDecoder;
}
const encoder = new NodeTextEncoder();

const SIG = 'motion:mpu6050';
const HELLO = `TBAI1,H,motion,${SIG},24`;
const example = x => `TBAI1,F,${new Array(24).fill(x).join(',')}`;

let root;
let result;
let onTake;
let setBusy;

const Harness = props => {
    result = useAiRecorder(props);
    return null;
};

const render = (active = true) => act(() => {
    ReactDOM.render(<Harness active={active} kind="motion" sig={SIG} count={24} onTake={onTake} setBusy={setBusy} />, root);
});
const flush = () => act(async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
});
const send = (...lines) => act(() => {
    mockListener(encoder.encode(lines.map(l => `${l}\r\n`).join('')));
});

beforeEach(async () => {
    root = document.createElement('div');
    onTake = jest.fn();
    setBusy = jest.fn();
    render();
    await flush();
});

afterEach(() => {
    act(() => {
        ReactDOM.unmountComponentAtNode(root);
    });
});

describe('Edge AI recorder', () => {
    test('waits for the recorder to say hello with the right parts', () => {
        expect(result.board).toBe('waiting');
        send('TBAI1,H,motion,motion:mpu6050,12');
        expect(result.board).toBe('other');
        send(HELLO);
        expect(result.board).toBe('ready');
        send('TBAI1,L,64');
        expect(result.level).toBe(64);
    });

    test('lines split across reads still count', () => {
        act(() => {
            mockListener(encoder.encode('TBAI1,H,mot'));
            mockListener(encoder.encode(`ion,${SIG},24\n`));
        });
        expect(result.board).toBe('ready');
    });

    test('one recording is 10 examples, then it stops by itself', () => {
        send(HELLO);
        act(() => result.record('wave', 40));
        expect(setBusy).toHaveBeenLastCalledWith(true);
        expect(result.recording).toEqual({thing: 'wave', got: 0, target: 10});
        send(example(9).replace(',9', ''));
        expect(result.recording.got).toBe(0);
        send(...Array.from({length: 12}, (_, i) => example(i)));
        expect(onTake).toHaveBeenCalledTimes(1);
        expect(onTake.mock.calls[0][0]).toBe('wave');
        expect(onTake.mock.calls[0][1]).toHaveLength(10);
        expect(result.recording).toBeNull();
        expect(setBusy).toHaveBeenLastCalledWith(false);
        expect(result.latest.f[0]).toBe(11);
    });

    test('only records the room a thing has left', () => {
        send(HELLO);
        act(() => result.record('wave', 3));
        send(example(1), example(2), example(3), example(4));
        expect(onTake.mock.calls[0][1]).toHaveLength(3);
    });

    test('Stop keeps what it got so far', () => {
        send(HELLO);
        act(() => result.record('wave', 40));
        send(example(1), example(2));
        act(() => result.stop());
        expect(onTake).toHaveBeenCalledWith('wave', [new Array(24).fill(1), new Array(24).fill(2)]);
    });

    test('a missing sensor ends the recording, and a move brings it back', () => {
        send(HELLO);
        act(() => result.record('wave', 40));
        send(example(1));
        send('TBAI1,E,no_sensor');
        expect(result.board).toBe('no_sensor');
        expect(onTake).toHaveBeenCalledWith('wave', [new Array(24).fill(1)]);
        send(HELLO);
        expect(result.board).toBe('no_sensor');
        send('TBAI1,L,10');
        expect(result.board).toBe('ready');
    });

    test('leaving the page ends the recording and stops listening', async () => {
        send(HELLO);
        act(() => result.record('wave', 40));
        send(example(5));
        render(false);
        await flush();
        expect(result.board).toBe('off');
        expect(onTake).toHaveBeenCalledWith('wave', [new Array(24).fill(5)]);
        expect(mockListener).toBeNull();
        expect(setBusy).toHaveBeenLastCalledWith(false);
    });

    test('cannot record before the board is ready', () => {
        act(() => result.record('wave', 40));
        expect(result.recording).toBeNull();
        expect(setBusy).not.toHaveBeenCalledWith(true);
    });
});
