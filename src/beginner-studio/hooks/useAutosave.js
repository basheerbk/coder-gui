import {useCallback, useEffect, useMemo, useRef} from 'react';

import {forgetProject, saveProject} from '../domain/autosave';

const DELAY_MS = 500;

/**
 * Saves the project shortly after each change and when the tab closes.
 * @param {object} state studio state
 * @param {string} email signed-in account (null for local dev)
 * @returns {{saveNow: Function, forgetLocalProject: Function}} controls for sign-out
 */
const useAutosave = (state, email) => {
    const enabled = useRef(true);
    const latest = useRef(state);
    const first = useRef(true);
    latest.current = state;

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (!enabled.current) {
            return;
        }
        const timer = setTimeout(() => saveProject(email, latest.current), DELAY_MS);
        return () => clearTimeout(timer);
    }, [state.connections, state.program, state.projectName, state.cloud, state.activeTemplateId, email]);

    useEffect(() => {
        const flush = () => {
            if (enabled.current) {
                saveProject(email, latest.current);
            }
        };
        window.addEventListener('pagehide', flush);
        return () => window.removeEventListener('pagehide', flush);
    }, [email]);

    const saveNow = useCallback(() => (enabled.current ? saveProject(email, latest.current) : false), [email]);

    /** Remove this account's saved project and stop saving (shared computer sign-out). */
    const forgetLocalProject = useCallback(() => {
        enabled.current = false;
        forgetProject(email);
    }, [email]);

    return useMemo(() => ({saveNow, forgetLocalProject}), [saveNow, forgetLocalProject]);
};

export default useAutosave;
