import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import useUndoHistory from '../../../src/beginner-studio/hooks/useUndoHistory';

let root;
let api;

const Harness = () => {
    const [state, setState] = useState({connections: [], program: [], ai: null, aiBusy: false});
    const history = useUndoHistory(state, setState);
    api = {state, setState, history};
    return null;
};

const change = patch => act(() => {
    api.setState(prev => Object.assign({}, prev, patch));
});

let clock = 1000;
beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    root = document.createElement('div');
    act(() => {
        ReactDOM.render(<Harness />, root);
    });
});

afterEach(() => {
    act(() => {
        ReactDOM.unmountComponentAtNode(root);
    });
    Date.now.mockRestore();
});

describe('undo with Edge AI', () => {
    test('what the AI learned is one undo step', () => {
        const ai = {kind: 'motion', things: [{id: 'a', name: 'A'}], samples: [], sig: null};
        change({ai});
        clock += 5000;
        const taught = Object.assign({}, ai, {samples: [{thing: 'a', take: 0, f: [1]}], sig: 'motion:mpu6050'});
        change({ai: taught});
        act(() => api.history.undo());
        expect(api.state.ai).toBe(ai);
        act(() => api.history.redo());
        expect(api.state.ai).toBe(taught);
    });

    test('is paused while a recording runs', () => {
        const ai = {kind: 'motion', things: [], samples: [], sig: null};
        change({ai});
        clock += 5000;
        change({aiBusy: true});
        expect(api.history.canUndo).toBe(false);
        act(() => api.history.undo());
        expect(api.state.ai).toBe(ai);
        change({aiBusy: false});
        expect(api.history.canUndo).toBe(true);
        act(() => api.history.undo());
        expect(api.state.ai).toBeNull();
    });
});
