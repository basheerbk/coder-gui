import React, {createContext, useContext, useMemo, useState} from 'react';

import useGeneratedCode from '../hooks/useGeneratedCode';
import useStudioActions from '../hooks/useStudioActions';
import {readStoredTheme, tokensFor} from '../domain/tokens';

const StudioContext = createContext(null);

const initialState = () => ({
    connections: [],
    program: [],
    selectedModule: null,
    addTarget: null,
    projectName: 'My Project',
    activeTemplateId: null,
    categoryFilter: 'all',
    blockPaletteCategory: 'actions',
    showCodePanel: true,
    showProjectLibrary: false,
    view: 'build',
    flashPortId: null,
    wireHint: null,
    theme: typeof window !== 'undefined' ? readStoredTheme() : 'dark'
});

const StudioProvider = ({children}) => {
    const [state, setState] = useState(initialState);
    const actions = useStudioActions(state, setState);
    const generatedCode = useGeneratedCode(state.connections, state.program);
    const K = tokensFor(state.theme);

    const value = useMemo(() => Object.assign({}, state, actions, {generatedCode, K}), [
        state,
        actions,
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
