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

const snapshot = state => ({connections: state.connections, program: state.program, ai: state.ai || null});

const sameSnap = (a, b) => a.connections === b.connections && a.program === b.program && a.ai === b.ai;

/**
 * Undo / redo for what the user builds: wired parts, the program and what the AI learned.
 * Paused while Edge AI is recording, which saves its examples as one step when it stops.
 * @param {object} state studio state
 * @param {Function} setState studio setState
 * @returns {{undo: Function, redo: Function, canUndo: boolean, canRedo: boolean}} history controls
 */
const useUndoHistory = (state, setState) => {
    const history = useRef({
        past: [],
        future: [],
        last: snapshot(state),
        lastAt: 0,
        restoring: false
    });
    const busy = useRef(false);
    busy.current = Boolean(state.aiBusy);
    const [sizes, setSizes] = useState({past: 0, future: 0});
    const sync = () => setSizes({past: history.current.past.length, future: history.current.future.length});

    useEffect(() => {
        const h = history.current;
        const snap = snapshot(state);
        if (sameSnap(snap, h.last)) {
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
    }, [state.connections, state.program, state.ai]);

    const restore = useCallback((from, to) => {
        const h = history.current;
        if (!h[from].length || busy.current) {
            return;
        }
        const snap = h[from].pop();
        h[to].push(h.last);
        h.restoring = true;
        h.lastAt = 0;
        setState(prev => Object.assign({}, prev, {
            connections: snap.connections,
            program: snap.program,
            ai: snap.ai,
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

    const paused = Boolean(state.aiBusy);
    return useMemo(
        () => ({undo, redo, canUndo: sizes.past > 0 && !paused, canRedo: sizes.future > 0 && !paused}),
        [undo, redo, sizes, paused]
    );
};

export default useUndoHistory;
