import {forgetProject, loadProject, saveProject} from '../../../src/beginner-studio/domain/autosave';

const memoryStorage = () => {
    const data = {};
    return {
        getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => {
            data[k] = String(v);
        },
        removeItem: k => {
            delete data[k];
        },
        keys: () => Object.keys(data)
    };
};

let store;
beforeEach(() => {
    store = memoryStorage();
    Object.defineProperty(window, 'localStorage', {value: store, configurable: true});
});

const project = {
    projectName: 'Smart Garden',
    connections: [{id: 'c1', moduleId: 'led', portId: 'p1'}],
    program: [{uid: 'b1', type: 'if_then', params: {sensor: 's'}, children: [{uid: 'b2', type: 'wait', params: {}}]}],
    cloud: {deviceId: 'd1', deviceName: 'Garden', email: 'kid@school.org'},
    activeTemplateId: 'smart-garden',
    theme: 'dark',
    showSerial: true
};

describe('beginner autosave', () => {
    test('round-trips the project and keeps UI-only state out', () => {
        expect(saveProject('kid@school.org', project)).toBe(true);
        const loaded = loadProject('kid@school.org');
        expect(loaded.projectName).toBe('Smart Garden');
        expect(loaded.connections).toEqual(project.connections);
        expect(loaded.program[0].children[0].uid).toBe('b2');
        expect(loaded.cloud.deviceId).toBe('d1');
        expect(loaded.activeTemplateId).toBe('smart-garden');
        expect(loaded.theme).toBeUndefined();
        expect(loaded.showSerial).toBeUndefined();
    });

    test('keeps accounts apart and ignores email case', () => {
        saveProject('Kid@School.org', project);
        expect(loadProject('kid@school.org').projectName).toBe('Smart Garden');
        expect(loadProject('other@school.org')).toBeNull();
        expect(loadProject(null)).toBeNull();
    });

    test('local dev without an account still saves', () => {
        saveProject(null, project);
        expect(loadProject(null).projectName).toBe('Smart Garden');
    });

    test('corrupted or old-format data is ignored, not thrown', () => {
        store.setItem('tb_beginner_project:a@b.c', '{not json');
        expect(loadProject('a@b.c')).toBeNull();
        store.setItem('tb_beginner_project:a@b.c', JSON.stringify({v: 99, program: []}));
        expect(loadProject('a@b.c')).toBeNull();
    });

    test('drops malformed blocks, connections and a cloud link from another account', () => {
        store.setItem('tb_beginner_project:a@b.c', JSON.stringify({
            v: 1,
            projectName: '   ',
            connections: [{id: 'ok', moduleId: 'led', portId: 'p'}, {id: 3}, null],
            program: [
                {uid: 'x', type: 'wait', params: 'bad', children: 'nope'},
                {type: 'wait'},
                'junk'
            ],
            cloud: {deviceId: 'd9', email: 'someone@else.org'}
        }));
        const loaded = loadProject('a@b.c');
        expect(loaded.projectName).toBe('My Project');
        expect(loaded.connections.map(c => c.id)).toEqual(['ok']);
        expect(loaded.program).toHaveLength(1);
        expect(loaded.program[0].params).toEqual({});
        expect(loaded.program[0].children).toEqual([]);
        expect(loaded.cloud).toBeNull();
    });

    test('forgetProject removes only that account', () => {
        saveProject('a@b.c', project);
        saveProject('d@e.f', project);
        forgetProject('a@b.c');
        expect(loadProject('a@b.c')).toBeNull();
        expect(loadProject('d@e.f')).not.toBeNull();
    });

    test('a browser that refuses storage does not break saving', () => {
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: () => null,
                setItem: () => {
                    throw new Error('QuotaExceededError');
                },
                removeItem: () => {}
            }
        });
        expect(saveProject('a@b.c', project)).toBe(false);
        expect(loadProject('a@b.c')).toBeNull();
    });
});
