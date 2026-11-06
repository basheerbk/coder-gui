import React, {createContext, useContext, useMemo, useState} from 'react';

import useAiActions from '../hooks/useAiActions';
import useAutosave from '../hooks/useAutosave';
import useGeneratedCode from '../hooks/useGeneratedCode';
import useStudioActions from '../hooks/useStudioActions';
import useUndoHistory from '../hooks/useUndoHistory';
import {loadProject} from '../domain/autosave';
import {readStoredTheme, tokensFor} from '../domain/tokens';

const StudioContext = createContext(null);

const freshState = () => ({
    connections: [],
    program: [],
    selectedModule: null,
    addTarget: null,
    projectName: 'My Project',
    activeTemplateId: null,
    categoryFilter: 'all',
    blockPaletteCategory: 'actions',
    showCodePanel: false,
    showSerial: false,
    showProjectLibrary: false,
    view: 'build',
    flashPortId: null,
    wireHint: null,
    // {deviceId, deviceName, intervalSec, ssid, email} once Cloud is set up; never holds secrets.
    cloud: null,
    showCloudSetup: false,
    // {kind, things: [{id, name}], samples: [{thing, take, f}], sig} once Edge AI is used.
    ai: null,
    // Edge AI is recording: undo waits until the examples are saved.
    aiBusy: false,
    theme: typeof window !== 'undefined' ? readStoredTheme() : 'dark'
});

/** Start from the account's autosaved project when there is one. */
const initialState = email => {
    const saved = typeof window === 'undefined' ? null : loadProject(email);
    return saved ? Object.assign(freshState(), saved) : freshState();
};

/**
 * @param {object} props.user signed-in account from /api/auth/me ({email, name, picture}), or null in local dev
 */
const StudioProvider = ({user, children}) => {
    const email = user && user.email ? user.email : null;
    const [state, setState] = useState(() => initialState(email));
    const actions = useStudioActions(state, setState);
    const aiActions = useAiActions(setState);
    const history = useUndoHistory(state, setState);
    const autosave = useAutosave(state, email);
    const generatedCode = useGeneratedCode(state.connections, state.program, state.cloud, state.ai);
    const K = tokensFor(state.theme);

    const value = useMemo(() => Object.assign({}, state, actions, aiActions, history, autosave, {generatedCode, K, user}), [
        state,
        actions,
        aiActions,
        history,
        autosave,
        user,
        generatedCode,
        K
    ]);

    return (
        <StudioContext.Provider value={value}>
            {children}
        </StudioContext.Provider>
    );
};

const useStudio = () => {
    const ctx = useContext(StudioContext);
    if (!ctx) {
        throw new Error('useStudio must be used within StudioProvider');
    }
    return ctx;
};

export {StudioProvider, useStudio};
