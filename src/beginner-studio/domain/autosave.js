/**
 * Keeps each signed-in person's current project in this browser so a refresh, a crash or
 * signing out never wipes their work. Namespaced per account like cloudSecrets; never
 * stores WiFi passwords or device keys (state.cloud only holds ids and names).
 */
import {cleanAi} from './ai/aiState';

const PREFIX = 'tb_beginner_project';
// `ai` was added without a version bump: older Studio tabs ignore it instead of refusing the save.
const VERSION = 1;

const keyFor = email => `${PREFIX}:${String(email || 'local').toLowerCase()}`;

const storage = () => {
    try {
        return window.localStorage;
    } catch (err) {
        return null;
    }
};

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

const cleanConnections = list => (Array.isArray(list) ? list : []).filter(c =>
    isObject(c) && typeof c.id === 'string' && typeof c.moduleId === 'string' && typeof c.portId === 'string');

const cleanBlocks = list => (Array.isArray(list) ? list : [])
    .filter(b => isObject(b) && typeof b.uid === 'string' && typeof b.type === 'string')
    .map(b => Object.assign({}, b, {
        params: isObject(b.params) ? b.params : {},
        children: cleanBlocks(b.children),
        elseChildren: cleanBlocks(b.elseChildren)
    }));

/**
 * The saved project for this account, or null when there is none or it is unreadable.
 * @param {string} email signed-in account (null for local dev)
 * @returns {object|null} {projectName, connections, program, cloud, activeTemplateId, ai}
 */
const loadProject = email => {
    const s = storage();
    if (!s) {
        return null;
    }
    try {
        const data = JSON.parse(s.getItem(keyFor(email)) || 'null');
        if (!isObject(data) || data.v !== VERSION) {
            return null;
        }
        const cloud = isObject(data.cloud) && typeof data.cloud.deviceId === 'string' &&
            (!data.cloud.email || !email || String(data.cloud.email).toLowerCase() === String(email).toLowerCase()) ?
            data.cloud :
            null;
        return {
            projectName: typeof data.projectName === 'string' && data.projectName.trim() ?
                data.projectName.slice(0, 80) :
                'My Project',
            connections: cleanConnections(data.connections),
            program: cleanBlocks(data.program),
            cloud,
            activeTemplateId: typeof data.activeTemplateId === 'string' ? data.activeTemplateId : null,
            ai: cleanAi(data.ai)
        };
    } catch (err) {
        return null;
    }
};

/**
 * @param {string} email signed-in account
 * @param {object} state studio state
 * @returns {boolean} false when the browser refused (private mode, storage full)
 */
const saveProject = (email, state) => {
    const s = storage();
    if (!s) {
        return false;
    }
    try {
        s.setItem(keyFor(email), JSON.stringify({
            v: VERSION,
            savedAt: Date.now(),
            projectName: state.projectName,
            connections: state.connections,
            program: state.program,
            cloud: state.cloud,
            activeTemplateId: state.activeTemplateId,
            ai: state.ai || null
        }));
        return true;
    } catch (err) {
        return false;
    }
};

const forgetProject = email => {
    const s = storage();
    if (!s) {
        return;
    }
    try {
        s.removeItem(keyFor(email));
    } catch (err) {
        // nothing to clean up
    }
};

export {forgetProject, loadProject, saveProject};
