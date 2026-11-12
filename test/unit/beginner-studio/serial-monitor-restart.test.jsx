import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';
import {TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder} from 'util';

import useSerialMonitor from '../../../src/beginner-studio/hooks/useSerialMonitor';

let mockHandler = null;
let mockMonitoring = false;
const mockSignals = [];
const mockPort = {
    setSignals: jest.fn(s => {
        mockSignals.push(s);
        return Promise.resolve();
    })
};
let mockUploading = false;

jest.mock('../../../src/lib/web-serial/serial-monitor', () => ({
    FLASH_START: 'flash-start',
    FLASH_COMPLETE: 'flash-complete',
    MONITOR_START: 'monitor-start',
    MONITOR_STOP: 'monitor-stop',
    webSerialMonitorEvents: {addEventListener: jest.fn(), removeEventListener: jest.fn()},
    setSerialDataHandler: jest.fn(fn => {
        mockHandler = fn;
    }),
    isSerialMonitoring: jest.fn(() => mockMonitoring),
    startSerialMonitor: jest.fn(() => {
        mockMonitoring = true;
        return Promise.resolve();
    }),
    stopSerialMonitor: jest.fn(() => {
        mockMonitoring = false;
        return Promise.resolve();
    }),
    writeSerialMonitor: jest.fn(() => Promise.resolve())
}));
jest.mock('../../../src/lib/web-serial/web-serial-port', () => ({
    isConnected: () => true,
    getPort: () => mockPort
}));
jest.mock('../../../src/lib/web-serial/upload-state', () => ({isUploadInProgress: () => mockUploading}));
jest.mock('../../../src/lib/web-serial/supported-browsers', () => ({isWebSerialSupported: () => true}));

if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = NodeTextDecoder;
}
const encoder = new NodeTextEncoder();

let root;
let result;
let now;

const Harness = () => {
    result = useSerialMonitor({connected: true, baudRate: 9600});
    return null;
};

const flush = () => act(async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
});

// Move the clock and the timers together, letting awaited timeouts resume.
const tick = async ms => {
    now += ms;
    act(() => {
        jest.runTimersToTime(ms);
    });
    await flush();
};

const boardSays = text => act(() => {
    mockHandler(encoder.encode(text));
});

// Start, then let the reset finish (it holds EN low for 100 ms).
const startMonitor = async () => {
    let started;
    act(() => {
        started = result.start();
    });
    await flush();
    await tick(100);
    await act(() => started);
};

beforeEach(async () => {
    jest.useFakeTimers();
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockSignals.length = 0;
    mockPort.setSignals.mockClear();
    mockMonitoring = false;
    mockUploading = false;
    root = document.createElement('div');
    act(() => {
        ReactDOM.render(<Harness />, root);
    });
    await flush();
});

afterEach(() => {
    act(() => {
        ReactDOM.unmountComponentAtNode(root);
    });
    Date.now.mockRestore();
    jest.useRealTimers();
});

describe('Serial monitor Start restarts the board', () => {
    test('it holds EN low with GPIO 0 high, then lets go, so a board in flashing mode runs its program', async () => {
        await startMonitor();
        expect(result.monitoring).toBe(true);
        expect(mockSignals).toEqual([
            {dataTerminalReady: false, requestToSend: true},
            {requestToSend: false}
        ]);
    });

    test('the boot log right after the reset is left out; the program lines show', async () => {
        await startMonitor();
        boardSays('ets Jul 29 2019 12:21:46\r\nrst:0x1 (POWERON_RESET)');
        expect(result.lines).toBe('');
        await tick(500);
        boardSays('TinkerBit Beginner ready\r\n');
        expect(result.lines).toBe('TinkerBit Beginner ready\r\n');
    });

    test('a silent board gets the press-RST hint, which goes away when it prints', async () => {
        await startMonitor();
        await tick(3900);
        expect(result.hint).toBe('');
        await tick(200);
        expect(result.hint).toMatch(/press RST on the board once/);
        boardSays('hello\r\n');
        expect(result.hint).toBe('');
    });

    test('a board that prints in time never sees the hint', async () => {
        await startMonitor();
        await tick(1500);
        boardSays('TinkerBit Beginner ready\r\n');
        await tick(5000);
        expect(result.hint).toBe('');
    });

    test('Stop clears the hint and its timer', async () => {
        await startMonitor();
        await act(() => result.stop());
        await tick(5000);
        expect(result.hint).toBe('');
        expect(result.monitoring).toBe(false);
    });

    test('a driver that refuses the signals still starts the monitor and shows output at once', async () => {
        mockPort.setSignals.mockImplementationOnce(() => Promise.reject(new Error('not supported')));
        await startMonitor();
        expect(result.monitoring).toBe(true);
        boardSays('LED: blink 400ms\r\n');
        expect(result.lines).toBe('LED: blink 400ms\r\n');
    });

    test('Start during an upload does nothing to the board', async () => {
        mockUploading = true;
        await startMonitor();
        expect(result.monitoring).toBe(false);
        expect(result.error).toMatch(/Wait for the upload to finish/);
        expect(mockSignals).toEqual([]);
    });

    test('a double click restarts the board once', async () => {
        let first;
        let second;
        act(() => {
            first = result.start();
            second = result.start();
        });
        await flush();
        await tick(100);
        await act(() => Promise.all([first, second]));
        expect(mockSignals.filter(s => s.requestToSend === true)).toHaveLength(1);
    });
});
