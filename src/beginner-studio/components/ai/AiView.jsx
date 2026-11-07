import React, {useEffect, useMemo, useRef, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {useUpload} from '../../context/UploadContext.jsx';
import {usesAi} from '../../domain/ai/aiFirmware';
import {MICROPYTHON} from '../../domain/boardLanguage';
import {
    AI_KINDS,
    AI_LIMITS,
    aiProblem,
    aiSignature,
    countsFor,
    featureCount,
    kindById,
    kindProblem,
    sensorInputs,
    thingNameProblem
} from '../../domain/ai/aiKinds';
import {checkModel, classify, trainModel} from '../../domain/ai/knn';
import {hasCloud} from '../../domain/cloud';
import {friendlyUpload} from '../../domain/friendlyUpload';
import {moduleById} from '../../domain/modules';
import {pickPortForModule} from '../../domain/ports';
import useAiRecorder from '../../hooks/useAiRecorder';
import {useWidth} from '../../../iot/hooks';
import {Button, Note, ui} from '../cloud/wizardUi.jsx';

import ThingList from './ThingList.jsx';

/** Below this width the things list sits above the steps. */
const NARROW = 900;
// A move's answer stays on screen this long before "Nothing" comes back.
const ANSWER_MS = 2500;
const NOTICE_MS = 8000;

const Section = ({K, n, title, done, dim, aside, children}) => (
    <section
        aria-label={title}
        style={{
            background: K.panel,
            border: `1px solid ${K.border}`,
            borderRadius: 14,
            padding: 18,
            opacity: dim ? 0.55 : 1
        }}
    >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 10 : 0}}>
            <span
                aria-hidden="true"
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: done ? K.green : (dim ? K.dim : K.accent),
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {done ? '✓' : n}
            </span>
            <h3 style={{fontSize: 15, fontWeight: 800, margin: 0, flex: 1, color: K.text}}>{title}</h3>
            {aside}
        </div>
        {children}
    </section>
);

const LinkButton = ({K, onClick, children, danger}) => (
    <button
        type="button"
        onClick={onClick}
        style={Object.assign({}, ui(K).link, {textDecoration: 'none', color: danger ? K.red : K.accent})}
    >
        {children}
    </button>
);

/** How hard the sensor is moving, with the line a move has to cross. */
const MoveMeter = ({K, level}) => (
    <div style={{marginTop: 10}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, color: K.dim, marginBottom: 4}}>
            <span>Still</span>
            <span>A move starts at the line</span>
        </div>
        <div
            role="meter"
            aria-label="How much the sensor is moving"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={level}
            style={{position: 'relative', height: 10, borderRadius: 5, background: K.border, overflow: 'hidden'}}
        >
            <div style={{height: '100%', width: `${level}%`, background: level >= 50 ? K.green : K.accent, transition: 'width 0.15s'}} />
            <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: K.text, opacity: 0.6}} />
        </div>
    </div>
);

const LiveValues = ({K, inputs, f}) => (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10}}>
        {inputs.map((input, i) => (
            <span key={input.name} style={{fontSize: 12, background: K.surface, borderRadius: 999, padding: '4px 10px', color: K.sub}}>
                {`${input.label}: `}
                <b style={{color: K.text}}>{f ? Math.round(f[i] * 10) / 10 : '…'}</b>
            </span>
        ))}
    </div>
);

const RenameForm = ({K, thing, things, onSave, onCancel}) => {
    const s = ui(K);
    const [name, setName] = useState(thing.name);
    const [error, setError] = useState('');
    const submit = e => {
        e.preventDefault();
        const problem = thingNameProblem(name, things, thing.id);
        if (problem) {
            setError(problem);
            return;
        }
        onSave(name.trim());
    };
    return (
        <form onSubmit={submit} style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px'}}>
            <label htmlFor="tb-rename-thing" style={Object.assign({}, s.label, {margin: 0})}>New name</label>
            <input
                id="tb-rename-thing"
                value={name}
                maxLength={AI_LIMITS.nameMax}
                autoFocus
                onChange={e => {
                    setName(e.target.value);
                    setError('');
                }}
                style={Object.assign({}, s.input, {width: 180, padding: '6px 8px'})}
            />
            <Button K={K} kind="primary" type="submit">Save</Button>
            <Button K={K} onClick={onCancel}>Cancel</Button>
            {error ? <div role="alert" style={{fontSize: 12, color: K.red, width: '100%'}}>{error}</div> : null}
        </form>
    );
};

/**
 * The Edge AI page: what the AI knows on the left, and on the right the steps to teach it on
 * the board, check it, try it live and use it in the program.
 */
const AiPage = () => {
    const {
        K, setView, ai, connections, program, undo, addBlock,
        setAiKind, addAiThing, renameAiThing, removeAiThing, clearAiThing, clearAiExamples, addAiTake, setAiBusy,
        selectModule, connectToPort
    } = useStudio();
    const upload = useUpload();
    const s = ui(K);
    const wrapRef = useRef(null);
    const width = useWidth(wrapRef);
    const narrow = width > 0 && width < NARROW;

    const kind = ai && ai.kind;
    const things = (ai && ai.things) || [];
    const counts = countsFor(ai);
    const sig = kind ? aiSignature(kind, connections) : '';
    const count = kind ? featureCount(kind, connections) : 0;
    const partsProblem = kind ? kindProblem(kind, connections) : null;
    const stale = Boolean(ai && ai.samples.length && ai.sig !== sig);
    const inputs = kind === 'sensors' ? sensorInputs(connections) : [];

    const [selected, setSelected] = useState(null);
    const [pickingKind, setPickingKind] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [notice, setNotice] = useState('');
    const [now, setNow] = useState(Date.now());

    const recorder = useAiRecorder({
        active: Boolean(kind) && !partsProblem && upload.connected && !upload.busy,
        kind,
        sig,
        count,
        onTake: (thingId, examples) => addAiTake(thingId, examples, sig),
        setBusy: setAiBusy
    });

    // A thing just added is the one to teach next; otherwise keep a thing selected, the first
    // one that still needs examples.
    const knownIds = useRef(null);
    useEffect(() => {
        const ids = things.map(t => t.id);
        const added = knownIds.current ? ids.filter(id => knownIds.current.indexOf(id) === -1) : [];
        knownIds.current = ids;
        if (added.length === 1 && !recorder.recording) {
            setSelected(added[0]);
            setRenaming(false);
            return;
        }
        if (!things.some(t => t.id === selected)) {
            const next = things.find(t => (counts[t.id] || 0) < AI_LIMITS.minExamples) || things[0];
            setSelected(next ? next.id : null);
            setRenaming(false);
        }
    }, [things, selected]);

    useEffect(() => {
        if (!notice) {
            return undefined;
        }
        const timer = setTimeout(() => setNotice(''), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);

    // Lets a move's answer fade back to "Nothing".
    useEffect(() => {
        if (kind !== 'motion') {
            return undefined;
        }
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [kind]);

    const usable = !stale && ai ? ai : null;
    const model = useMemo(() => (usable ? trainModel(usable) : null), [usable]);
    const ready = !aiProblem(ai, connections);
    const check = useMemo(() => (ready && !stale ? checkModel(ai) : null), [ai, ready, stale]);

    const thing = things.find(t => t.id === selected) || null;
    const thingCount = thing ? counts[thing.id] || 0 : 0;
    const room = AI_LIMITS.maxExamples - thingCount;
    const boardReady = recorder.board === 'ready';
    const recording = recorder.recording;
    const taught = things.filter(t => (counts[t.id] || 0) > 0).length;
    const canTry = Boolean(model) && taught >= AI_LIMITS.minThings;
    const kindInfo = kindById(kind);

    const withUndo = (change, text) => {
        change();
        setNotice(text);
    };

    const plugIn = moduleId => {
        const mod = moduleById(moduleId);
        const used = {};
        connections.forEach(c => {
            used[c.portId] = true;
        });
        const port = mod ? pickPortForModule(mod, used, hasCloud(connections)) : null;
        if (!port) {
            setView('build');
            return;
        }
        selectModule(moduleId);
        connectToPort(port);
    };

    // ---- 1. What it learns ----
    let kindBody;
    if (!kind || pickingKind) {
        kindBody = (
            <div style={{display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 10}}>
                {AI_KINDS.map(k => {
                    const missing = kindProblem(k.id, connections);
                    const chosen = kind === k.id;
                    return (
                        <button
                            key={k.id}
                            type="button"
                            aria-pressed={chosen}
                            onClick={() => {
                                setPickingKind(false);
                                if (chosen) {
                                    return;
                                }
                                if (ai && ai.samples.length) {
                                    withUndo(() => setAiKind(k.id), 'Switched, so the old examples were cleared.');
                                } else {
                                    setAiKind(k.id);
                                }
                            }}
                            style={{
                                textAlign: 'left',
                                padding: 14,
                                borderRadius: 12,
                                border: `2px solid ${chosen ? K.accent : K.border}`,
                                background: chosen ? `${K.accent}14` : K.surface,
                                color: K.text,
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                            }}
                        >
                            <span style={{display: 'block', fontSize: 14, fontWeight: 800, marginBottom: 4}}>{k.label}</span>
                            <span style={{display: 'block', fontSize: 12, color: K.sub, lineHeight: 1.45}}>{k.blurb}</span>
                            <span style={{display: 'block', fontSize: 11, marginTop: 8, color: missing ? K.orange : K.green, fontWeight: 700}}>
                                {missing ?
                                    (k.id === 'motion' ? 'Needs the MPU6050 motion sensor' : 'Needs a sensor on the board') :
                                    '✓ Your parts are ready'}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    } else {
        kindBody = (
            <div style={{fontSize: 13, color: K.sub, lineHeight: 1.5}}>
                {kindInfo.blurb}
                {kind === 'sensors' && inputs.length ? ` It uses: ${inputs.map(i => i.label).join(', ')}.` : ''}
            </div>
        );
    }
    let kindNote = null;
    if (kind && partsProblem) {
        kindNote = (
            <Note
                K={K}
                tone="orange"
                title={partsProblem}
                actions={kind === 'motion' ?
                    <Button K={K} kind="primary" onClick={() => plugIn('mpu6050')}>Plug it in for me</Button> :
                    <Button K={K} onClick={() => setView('build')}>Open Build</Button>}
            />
        );
    }

    // ---- 2. The board ----
    let boardBody;
    const friendly = friendlyUpload(upload);
    const recorderButton = (
        <Button K={K} kind="primary" disabled={upload.busy} onClick={() => upload.uploadRecorder(kind)}>
            Put the recorder on the board
        </Button>
    );
    if (!upload.supported) {
        boardBody = <Note K={K} tone="orange" title="Teaching the AI needs Chrome or Edge on a computer." />;
    } else if (upload.busy) {
        boardBody = (
            <div>
                <div style={{fontSize: 13, color: K.text, marginBottom: 6}}>{upload.message || 'Working…'}</div>
                {typeof upload.progress === 'number' ? (
                    <div style={{height: 6, borderRadius: 3, background: K.border, overflow: 'hidden'}}>
                        <div style={{height: '100%', width: `${Math.max(0, Math.min(100, upload.progress))}%`, background: K.accent}} />
                    </div>
                ) : null}
            </div>
        );
    } else if (!upload.connected) {
        boardBody = (
            <div>
                <p style={s.lead}>Plug your board into this computer with its USB cable, then connect it.</p>
                <Button K={K} kind="primary" onClick={upload.connectBoard}>Connect board</Button>
            </div>
        );
    } else if (boardReady) {
        boardBody = (
            <div>
                <div style={{fontSize: 13, color: K.green, fontWeight: 700}}>
                    {kind === 'motion' ? '✓ Your board is sending moves from the motion sensor' : '✓ Your board is sending sensor readings'}
                </div>
                <div style={Object.assign({}, s.small, {marginTop: 4})}>
                    Your program is off the board while you teach. When you are done, press Upload to put it back with the AI inside.
                </div>
            </div>
        );
    } else if (recorder.board === 'no_sensor') {
        boardBody = (
            <Note K={K} tone="red" title="The board cannot find the motion sensor">
                Check that its cable is pushed all the way into I2C. It tries again every few seconds.
            </Note>
        );
    } else {
        let lead = 'The board needs a small recorder program while you teach it. It replaces your program until you press Upload again.';
        if (recorder.board === 'other') {
            lead = 'The board has a recorder for different parts. Put the new one on it.';
        } else if (recorder.board === 'waiting') {
            lead = `Checking your board… ${lead}`;
        }
        boardBody = (
            <div>
                <p style={s.lead}>{lead}</p>
                {recorderButton}
                {upload.phase === 'error' ? <Note K={K} tone="red" title={friendly.text}>{friendly.tip || null}</Note> : null}
            </div>
        );
    }

    // ---- 3. Teaching ----
    let teachBody;
    if (!things.length) {
        teachBody = <div style={s.lead}>Add the things it should learn on the left, like “{kindInfo ? kindInfo.examples[0] : 'Wave'}”.</div>;
    } else if (stale) {
        teachBody = (
            <Note
                K={K}
                tone="orange"
                title="Your parts changed since you recorded"
                actions={<Button K={K} onClick={() => withUndo(clearAiExamples, 'Old examples cleared.')}>Clear the old examples</Button>}
            >
                The old examples were made with other parts, so they no longer fit. Clear them and record again.
            </Note>
        );
    } else if (thing) {
        const how = kind === 'motion' ?
            `Press Record, then do the “${thing.name}” move. Hold the sensor still between moves: each move becomes one example.` :
            `Set up “${thing.name}” in front of your sensors, then press Record. It takes one example every second.`;
        const recordingThis = recording && recording.thing === thing.id;
        teachBody = (
            <div>
                {renaming ? (
                    <RenameForm
                        K={K}
                        thing={thing}
                        things={things}
                        onSave={name => {
                            renameAiThing(thing.id, name);
                            setRenaming(false);
                        }}
                        onCancel={() => setRenaming(false)}
                    />
                ) : null}
                <p style={s.lead}>{how}</p>
                {recordingThis ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                        <span role="status" style={{fontSize: 15, fontWeight: 800, color: K.red}}>
                            {`● Recording ${recording.got} of ${recording.target}`}
                        </span>
                        <Button K={K} onClick={recorder.stop}>Stop</Button>
                    </div>
                ) : (
                    <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                        <Button
                            K={K}
                            kind="primary"
                            disabled={!boardReady || Boolean(recording) || room <= 0}
                            onClick={() => {
                                setNotice('');
                                recorder.record(thing.id, room);
                            }}
                        >
                            {`Record “${thing.name}”`}
                        </Button>
                        <span style={s.small}>
                            {room <= 0 ?
                                `${AI_LIMITS.maxExamples} examples is the most for one thing.` :
                                `${thingCount} so far · it stops by itself after ${Math.min(AI_LIMITS.takeSize, room)}`}
                        </span>
                    </div>
                )}
                {!boardReady ? <div style={Object.assign({}, s.small, {marginTop: 8})}>Get the board ready first (step 2).</div> : null}
                {boardReady && kind === 'motion' ? <MoveMeter K={K} level={recorder.level} /> : null}
                {boardReady && kind === 'sensors' ? <LiveValues K={K} inputs={inputs} f={recorder.latest && recorder.latest.f} /> : null}
            </div>
        );
    }
    const teachAside = thing && !stale && !recording ? (
        <div style={{display: 'flex', gap: 12}}>
            <LinkButton K={K} onClick={() => setRenaming(true)}>Rename</LinkButton>
            {thingCount ? (
                <LinkButton
                    K={K}
                    onClick={() => withUndo(() => clearAiThing(thing.id), `Cleared the examples of “${thing.name}”.`)}
                >
                    Start over
                </LinkButton>
            ) : null}
            <LinkButton
                K={K}
                danger
                onClick={() => withUndo(() => removeAiThing(thing.id), `Removed “${thing.name}”.`)}
            >
                Remove
            </LinkButton>
        </div>
    ) : null;

    // ---- 4. Try and use ----
    let answer = null;
    if (canTry && boardReady && !recording && recorder.latest) {
        const fresh = kind !== 'motion' || now - recorder.latest.at < ANSWER_MS;
        if (fresh) {
            const result = classify(model, recorder.latest.f);
            answer = result.unsure ? 'Not sure' : result.thing.name;
        }
    }
    if (!answer && kind === 'motion') {
        answer = 'Nothing';
    }
    let tryBody;
    if (!canTry) {
        tryBody = <div style={s.lead}>Record examples of at least 2 things, then try it here.</div>;
    } else {
        const weak = check ? things.filter(t => {
            const row = check.perThing[t.id];
            return row && row.total && row.right / row.total < 0.8;
        }) : [];
        tryBody = (
            <div>
                {check ? (
                    <div style={{marginBottom: 12}}>
                        <div style={{fontSize: 13, color: K.text, fontWeight: 700}}>
                            {`Tested on examples it had not seen: ${check.right} of ${check.total} right`}
                        </div>
                        <ul style={{listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 4}}>
                            {things.map(t => {
                                const row = check.perThing[t.id];
                                const mixed = Object.keys(row.mixedWith).map(id => {
                                    const other = things.find(o => o.id === id);
                                    return other ? `${other.name} ${row.mixedWith[id]}×` : null;
                                }).filter(Boolean);
                                return (
                                    <li key={t.id} style={{fontSize: 12, color: K.sub}}>
                                        <b style={{color: K.text}}>{t.name}</b>
                                        {`: ${row.right} of ${row.total}`}
                                        {mixed.length ? ` (mixed up with ${mixed.join(', ')})` : ''}
                                    </li>
                                );
                            })}
                        </ul>
                        {weak.length ? (
                            <Note K={K} tone="orange" title={`Tip: record more “${weak[0].name}” examples`}>
                                {kind === 'motion' ?
                                    'Or make the moves more different from each other.' :
                                    'Or make the moments more different from each other.'}
                            </Note>
                        ) : null}
                    </div>
                ) : (
                    <Note K={K} tone="blue" title={`Record at least ${AI_LIMITS.minExamples} examples of each thing to use it in your program.`} />
                )}
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        marginTop: 12,
                        borderRadius: 14,
                        background: K.canvas,
                        border: `1px solid ${K.border}`,
                        padding: '18px 16px',
                        textAlign: 'center'
                    }}
                >
                    <div style={{fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: K.dim}}>
                        The AI thinks it is
                    </div>
                    <div style={{fontSize: 28, fontWeight: 800, color: boardReady && !recording ? K.text : K.dim, marginTop: 4}}>
                        {boardReady && !recording ? (answer || '…') : '…'}
                    </div>
                    <div style={Object.assign({}, s.small, {marginTop: 4})}>
                        {boardReady && !recording ?
                            (kind === 'motion' ? 'Do a move to try it.' : 'Change what the sensors notice to try it.') :
                            'Try it when the board is ready and not recording.'}
                    </div>
                </div>
                {ready && !stale ? (
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 14}}>
                        {usesAi(program) ? (
                            <Button K={K} kind="primary" onClick={() => setView('code')}>Open my program</Button>
                        ) : (
                            <Button
                                K={K}
                                kind="primary"
                                onClick={() => {
                                    addBlock('if_then', {params: {sensor: 'aiAnswer', op: 'is', value: (thing || things[0]).id}});
                                    setView('code');
                                }}
                            >
                                Use it in my program
                            </Button>
                        )}
                        <span style={s.small}>Then press Upload to put your program back on the board with the AI inside.</span>
                    </div>
                ) : null}
            </div>
        );
    }

    const kindDone = Boolean(kind) && !partsProblem;
    const teachDone = things.length >= AI_LIMITS.minThings && things.every(t => (counts[t.id] || 0) >= AI_LIMITS.minExamples) && !stale;

    return (
        <main aria-label="Edge AI" style={{flex: 1, minHeight: 0, overflow: 'auto', background: K.canvas}}>
            <div ref={wrapRef} style={{maxWidth: 1400, margin: '0 auto', padding: '16px 16px 40px'}}>
                <div style={{margin: '0 2px 12px'}}>
                    <h2 style={{fontSize: 18, fontWeight: 800, color: K.text, margin: 0}}>Edge AI</h2>
                    <div style={{fontSize: 13, color: K.sub, marginTop: 2}}>
                        Teach your board to recognise things by showing it examples. It runs on the board itself, no internet needed.
                    </div>
                </div>
                <div
                    style={narrow ?
                        {display: 'grid', gap: 12} :
                        {display: 'grid', gridTemplateColumns: 'minmax(260px, 30%) minmax(0, 1fr)', gap: 16, alignItems: 'start'}}
                >
                    <div style={narrow ? null : {position: 'sticky', top: 0}}>
                        <ThingList
                            K={K}
                            kind={kind}
                            things={things}
                            counts={counts}
                            selected={selected}
                            recordingId={recording ? recording.thing : null}
                            placeholder={kindInfo ? kindInfo.examples[things.length % kindInfo.examples.length] : 'Wave'}
                            onSelect={id => {
                                if (!recording) {
                                    setSelected(id);
                                    setRenaming(false);
                                }
                            }}
                            onAdd={name => {
                                setNotice('');
                                addAiThing(name);
                            }}
                        />
                    </div>
                    <div style={{display: 'grid', gap: 12, minWidth: 0}}>
                        {notice ? (
                            <Note
                                K={K}
                                tone="blue"
                                title={notice}
                                actions={<Button K={K} onClick={() => {
                                    undo();
                                    setNotice('');
                                }}
                                >Undo</Button>}
                            />
                        ) : null}
                        <Section
                            K={K}
                            n={1}
                            title={kind && !pickingKind ? `It learns: ${kindInfo.label}` : 'What should it learn?'}
                            done={kindDone && !pickingKind}
                            aside={kind && !pickingKind && !recording ? <LinkButton K={K} onClick={() => setPickingKind(true)}>Change</LinkButton> : null}
                        >
                            {kindBody}
                            {kindNote}
                        </Section>
                        <Section K={K} n={2} title="Get your board ready" done={boardReady} dim={!kindDone}>
                            {kindDone ? boardBody : null}
                        </Section>
                        <Section
                            K={K}
                            n={3}
                            title={thing && !stale ? `Teach it “${thing.name}”` : 'Teach it'}
                            done={teachDone}
                            dim={!kindDone}
                            aside={kindDone ? teachAside : null}
                        >
                            {kindDone ? teachBody : null}
                        </Section>
                        <Section K={K} n={4} title="Try it and use it" dim={!canTry}>
                            {kindDone ? tryBody : null}
                        </Section>
                    </div>
                </div>
            </div>
        </main>
    );
};

/** The recorder and the AI program are Arduino: putting them on would wipe the board's MicroPython. */
const AiComingSoon = () => {
    const {K, setView} = useStudio();
    return (
        <main aria-label="Edge AI" style={{flex: 1, minHeight: 0, overflow: 'auto', background: K.canvas}}>
            <div style={{maxWidth: 640, margin: '0 auto', padding: '40px 16px'}}>
                <h2 style={{fontSize: 18, fontWeight: 800, color: K.text, margin: 0}}>Edge AI</h2>
                <div style={{fontSize: 13, color: K.sub, marginTop: 2, marginBottom: 16}}>
                    Teach your board to recognise things by showing it examples.
                </div>
                <Note
                    K={K}
                    tone="blue"
                    title="Coming soon in MicroPython"
                    actions={<Button K={K} onClick={() => setView('build')}>Back to Build</Button>}
                >
                    Edge AI is not ready for MicroPython boards yet. Your sensors, outputs and Cloud work already.
                </Note>
            </div>
        </main>
    );
};

/** Mounts the page only while it is open, so it measures its width and listens to the board then. */
const AiView = () => {
    const {view, boardLanguage} = useStudio();
    if (view !== 'ai') {
        return null;
    }
    return boardLanguage === MICROPYTHON ? <AiComingSoon /> : <AiPage />;
};

export default AiView;
