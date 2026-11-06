import {useCallback, useMemo} from 'react';

import {addTake, addThing, clearThing, emptyAi, removeThing, renameThing, setKind} from '../domain/ai/aiState';
import {uid} from '../domain/ids';

/** Edits to what the Edge AI knows. Each one is a single undo step. */
const useAiActions = setState => {
    const update = useCallback(change => {
        setState(prev => {
            const ai = change(prev.ai);
            return ai === prev.ai ? prev : Object.assign({}, prev, {ai});
        });
    }, [setState]);

    const setAiKind = useCallback(kind => update(ai => setKind(ai, kind)), [update]);
    const addAiThing = useCallback(name => update(ai => addThing(ai, uid('thing'), name)), [update]);
    const renameAiThing = useCallback((id, name) => update(ai => renameThing(ai, id, name)), [update]);
    const removeAiThing = useCallback(id => update(ai => removeThing(ai, id)), [update]);
    const clearAiThing = useCallback(id => update(ai => clearThing(ai, id)), [update]);
    const clearAiExamples = useCallback(() => update(ai => (ai ? Object.assign(emptyAi(ai.kind), {things: ai.things}) : ai)), [update]);
    const addAiTake = useCallback((thingId, examples, sig) => update(ai => addTake(ai, thingId, examples, sig)), [update]);
    const setAiBusy = useCallback(aiBusy => {
        setState(prev => (prev.aiBusy === aiBusy ? prev : Object.assign({}, prev, {aiBusy})));
    }, [setState]);

    return useMemo(() => ({
        setAiKind,
        addAiThing,
        renameAiThing,
        removeAiThing,
        clearAiThing,
        clearAiExamples,
        addAiTake,
        setAiBusy
    }), [setAiKind, addAiThing, renameAiThing, removeAiThing, clearAiThing, clearAiExamples, addAiTake, setAiBusy]);
};

export default useAiActions;
