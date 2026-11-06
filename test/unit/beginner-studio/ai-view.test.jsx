import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import AiView from '../../../src/beginner-studio/components/ai/AiView.jsx';
import {useStudio} from '../../../src/beginner-studio/context/StudioContext.jsx';
import {useUpload} from '../../../src/beginner-studio/context/UploadContext.jsx';
import {addTake, addThing, setKind} from '../../../src/beginner-studio/domain/ai/aiState';
import useAiRecorder from '../../../src/beginner-studio/hooks/useAiRecorder';

jest.mock('../../../src/beginner-studio/context/StudioContext.jsx', () => ({useStudio: jest.fn()}));
jest.mock('../../../src/beginner-studio/context/UploadContext.jsx', () => ({useUpload: jest.fn()}));
jest.mock('../../../src/beginner-studio/hooks/useAiRecorder', () => jest.fn());
jest.mock('../../../src/iot/hooks', () => ({useWidth: () => 1200}));

const K = new Proxy({}, {get: () => '#888888'});
const MPU = {id: 'mpu', moduleId: 'mpu6050', portId: 'I2C', pin: '21'};
const SIG = 'motion:mpu6050';
const WAVE = new Array(24).fill(0).map((_, i) => i % 3);
const CIRCLE = WAVE.map(v => v + 4);
const near = (center, n, offset) => Array.from({length: n}, (_, k) => center.map((v, i) => v + (((k * 7) + i + offset) % 5) * 0.1));

const twoThings = () => addThing(addThing(setKind(null, 'motion'), 'wave', 'Wave'), 'circle', 'Circle');
const taught = () => {
    let ai = twoThings();
    ai = addTake(ai, 'wave', near(WAVE, 10, 0), SIG);
    ai = addTake(ai, 'circle', near(CIRCLE, 10, 1), SIG);
    ai = addTake(ai, 'wave', near(WAVE, 10, 2), SIG);
    ai = addTake(ai, 'circle', near(CIRCLE, 10, 3), SIG);
    return ai;
};

let root;
let studio;
let upload;
let recorder;

const render = overrides => {
    studio = Object.assign({
        K,
        view: 'ai',
        setView: jest.fn(),
        ai: null,
        connections: [MPU],
        program: [],
        undo: jest.fn(),
        addBlock: jest.fn(),
        setAiKind: jest.fn(),
        addAiThing: jest.fn(),
        renameAiThing: jest.fn(),
        removeAiThing: jest.fn(),
        clearAiThing: jest.fn(),
        clearAiExamples: jest.fn(),
        addAiTake: jest.fn(),
        setAiBusy: jest.fn(),
        selectModule: jest.fn(),
        connectToPort: jest.fn()
    }, overrides && overrides.studio);
    upload = Object.assign({
        supported: true,
        connected: true,
        busy: false,
        phase: 'idle',
        message: '',
        progress: null,
        connectBoard: jest.fn(),
        uploadRecorder: jest.fn()
    }, overrides && overrides.upload);
    recorder = Object.assign({
        board: 'ready',
        level: 0,
        latest: null,
        recording: null,
        record: jest.fn(),
        stop: jest.fn()
    }, overrides && overrides.recorder);
    useStudio.mockReturnValue(studio);
    useUpload.mockReturnValue(upload);
    useAiRecorder.mockReturnValue(recorder);
    act(() => {
        ReactDOM.render(<AiView />, root);
    });
};

const click = el => act(() => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
});
const button = text => [...root.querySelectorAll('button')].find(b => b.textContent.indexOf(text) === 0);

beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
});

afterEach(() => {
    act(() => {
        ReactDOM.unmountComponentAtNode(root);
    });
    root.remove();
    jest.clearAllMocks();
});

describe('Edge AI page', () => {
    test('shows nothing on other pages', () => {
        render({studio: {view: 'build'}});
        expect(root.innerHTML).toBe('');
    });

    test('starts by asking what to learn, and says which parts are missing', () => {
        render({studio: {connections: []}});
        expect(root.textContent).toContain('What should it learn?');
        expect(button('Motion').textContent).toContain('Needs the MPU6050 motion sensor');
        expect(button('Sensors').textContent).toContain('Needs a sensor on the board');
        click(button('Motion'));
        expect(studio.setAiKind).toHaveBeenCalledWith('motion');
    });

    test('plugs the motion sensor in when asked', () => {
        render({studio: {ai: twoThings(), connections: []}});
        click(button('Plug it in for me'));
        expect(studio.selectModule).toHaveBeenCalledWith('mpu6050');
        expect(studio.connectToPort).toHaveBeenCalledWith('I2C');
    });

    test('puts the recorder on a connected board, and only listens while it is free', () => {
        render({studio: {ai: twoThings()}, recorder: {board: 'waiting'}});
        expect(useAiRecorder.mock.calls[0][0]).toEqual(expect.objectContaining({active: true, kind: 'motion', sig: SIG, count: 24}));
        click(button('Put the recorder on the board'));
        expect(upload.uploadRecorder).toHaveBeenCalledWith('motion');
        render({studio: {ai: twoThings()}, upload: {busy: true, message: 'Uploading 40%'}});
        expect(useAiRecorder.mock.calls[useAiRecorder.mock.calls.length - 1][0].active).toBe(false);
        expect(root.textContent).toContain('Uploading 40%');
    });

    test('records the selected thing, up to the room it has left', () => {
        render({studio: {ai: twoThings()}});
        expect(root.textContent).toContain('Teach it “Wave”');
        click(button('Record “Wave”'));
        expect(recorder.record).toHaveBeenCalledWith('wave', 40);
        render({studio: {ai: twoThings()}, recorder: {recording: {thing: 'wave', got: 3, target: 10}}});
        expect(root.textContent).toContain('● Recording 3 of 10');
        click(button('Stop'));
        expect(recorder.stop).toHaveBeenCalled();
    });

    test('a thing just added is the next one to teach', () => {
        render({studio: {ai: twoThings()}});
        const more = addThing(twoThings(), 'shake', 'Shake');
        render({studio: {ai: more}});
        expect(root.textContent).toContain('Teach it “Shake”');
    });

    test('tries the taught AI on the latest move and adds it to the program', () => {
        render({studio: {ai: taught()}, recorder: {latest: {f: WAVE, at: Date.now()}}});
        expect(root.textContent).toContain('Tested on examples it had not seen: 40 of 40 right');
        expect(root.querySelector('[role="status"][aria-live]').textContent).toContain('Wave');
        click(button('Use it in my program'));
        expect(studio.addBlock).toHaveBeenCalledWith('if_then', {params: {sensor: 'aiAnswer', op: 'is', value: 'wave'}});
        expect(studio.setView).toHaveBeenCalledWith('code');
    });

    test('a move from a while ago fades back to Nothing', () => {
        render({studio: {ai: taught()}, recorder: {latest: {f: CIRCLE, at: Date.now() - 10000}}});
        expect(root.querySelector('[role="status"][aria-live]').textContent).toContain('Nothing');
    });

    test('examples made with other parts must be cleared, with a way back', () => {
        const ai = Object.assign(taught(), {sig: 'motion:old'});
        render({studio: {ai}});
        expect(root.textContent).toContain('Your parts changed since you recorded');
        click(button('Clear the old examples'));
        expect(studio.clearAiExamples).toHaveBeenCalled();
        click(button('Undo'));
        expect(studio.undo).toHaveBeenCalled();
    });

    test('removing a thing can be undone', () => {
        render({studio: {ai: twoThings()}});
        click(button('Remove'));
        expect(studio.removeAiThing).toHaveBeenCalledWith('wave');
        expect(root.textContent).toContain('Removed “Wave”.');
    });
});
