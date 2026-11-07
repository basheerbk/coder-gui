import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import {ARDUINO, MICROPYTHON} from '../../../src/beginner-studio/domain/boardLanguage';
import {micropythonGaps} from '../../../src/beginner-studio/domain/pycodegen';
import {TEMPLATES} from '../../../src/beginner-studio/domain/templates';
import useStudioActions from '../../../src/beginner-studio/hooks/useStudioActions';

jest.mock('../../../src/beginner-studio/domain/sound', () => ({
    playConnect: () => {},
    playDisconnect: () => {},
    playTick: () => {}
}));

describe('parts and templates MicroPython does not have yet', () => {
    let root;
    let api;
    const mount = language => {
        const Harness = () => {
            const [state, setState] = useState({connections: [], program: [], selectedModule: null});
            api = {state, actions: useStudioActions(state, setState, language)};
            return null;
        };
        act(() => {
            ReactDOM.render(<Harness />, root);
        });
    };
    const gapTemplate = TEMPLATES.find(t => micropythonGaps(t.connections, t.program).length > 0);
    const freeTemplate = TEMPLATES.find(t => micropythonGaps(t.connections, t.program).length === 0);

    beforeEach(() => {
        jest.useFakeTimers();
        root = document.createElement('div');
    });

    afterEach(() => {
        act(() => {
            ReactDOM.unmountComponentAtNode(root);
        });
        jest.useRealTimers();
    });

    test('in MicroPython the RFID reader, heartbeat sensor and both Bluetooth parts go on', () => {
        mount(MICROPYTHON);
        act(() => api.actions.selectModule('rfid'));
        expect(api.state.selectedModule).toBe('rfid');
        expect(api.state.wireHint || '').not.toMatch(/Coming soon/);
        act(() => api.actions.selectModule('ble'));
        act(() => api.actions.selectModule('hc05'));
        act(() => api.actions.selectModule('pulse'));
        expect(api.state.connections.map(c => c.moduleId)).toEqual(expect.arrayContaining(['ble']));
        expect(api.state.wireHint || '').not.toMatch(/Coming soon/);
    });

    test('in MicroPython Cloud and ordinary parts still go on', () => {
        mount(MICROPYTHON);
        act(() => api.actions.selectModule('cloud'));
        expect(api.state.connections.map(c => c.moduleId)).toEqual(['cloud']);
        act(() => api.actions.selectModule('led'));
        act(() => api.actions.connectToPort('D13'));
        expect(api.state.connections.map(c => c.moduleId)).toEqual(['cloud', 'led']);
    });

    test('in MicroPython an Edge AI template does not load; others do', () => {
        expect(micropythonGaps(gapTemplate.connections, gapTemplate.program)).toEqual(['Edge AI']);
        mount(MICROPYTHON);
        act(() => api.actions.loadTemplate(gapTemplate.id));
        expect(api.state.activeTemplateId).toBeUndefined();
        act(() => api.actions.loadTemplate(freeTemplate.id));
        expect(api.state.activeTemplateId).toBe(freeTemplate.id);
    });

    test('the Arduino setting keeps every part and template', () => {
        mount(ARDUINO);
        act(() => api.actions.loadTemplate(gapTemplate.id));
        expect(api.state.activeTemplateId).toBe(gapTemplate.id);
        act(() => api.actions.selectModule('rfid'));
        expect(api.state.selectedModule).toBe('rfid');
    });
});
