import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const LIMIT = 60;
// Edits closer together than this (typing, slider drags) undo as one step.
const MERGE_MS = 700;

const isTyping = target => {
    if (!target) {
        return false;
    }
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

/**
 * Undo / redo for what the user builds: wired parts and the program.
 * @param {object} state studio state
 * @param {Function} setState studio setState
 * @returns {{undo: Function, redo: Function, canUndo: boolean, canRedo: boolean}} history controls
 */
const useUndoHistory = (state, setState) => {
    const history = useRef({
        past: [],
        future: [],
        last: {connections: state.connections, program: state.program},
        lastAt: 0,
        restoring: false
    });
    const [sizes, setSizes] = useState({past: 0, future: 0});
    const sync = () => setSizes({past: history.current.past.length, future: history.current.future.length});

    useEffect(() => {
        const h = history.current;
        const snap = {connections: state.connections, program: state.program};
        if (snap.connections === h.last.connections && snap.program === h.last.program) {
            return;
        }
        if (h.restoring) {
            h.restoring = false;
            h.last = snap;
            return;
        }
        const now = Date.now();
        if (now - h.lastAt > MERGE_MS || !h.past.length) {
            h.past.push(h.last);
            if (h.past.length > LIMIT) {
                h.past.shift();
            }
        }
        h.future = [];
        h.last = snap;
        h.lastAt = now;
        sync();
    }, [state.connections, state.program]);

    const restore = useCallback((from, to) => {
        const h = history.current;
        if (!h[from].length) {
            return;
        }
        const snap = h[from].pop();
        h[to].push(h.last);
        h.restoring = true;
        h.lastAt = 0;
        setState(prev => Object.assign({}, prev, {
            connections: snap.connections,
            program: snap.program,
            selectedModule: null,
            addTarget: null,
            wireHint: null,
            activeTemplateId: null
        }));
        sync();
    }, [setState]);

    const undo = useCallback(() => restore('past', 'future'), [restore]);
    const redo = useCallback(() => restore('future', 'past'), [restore]);

    useEffect(() => {
        const onKey = e => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) {
                return;
            }
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);

    return useMemo(
        () => ({undo, redo, canUndo: sizes.past > 0, canRedo: sizes.future > 0}),
        [undo, redo, sizes]
    );
};

export default useUndoHistory;
