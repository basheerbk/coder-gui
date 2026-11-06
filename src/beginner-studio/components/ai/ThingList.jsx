import React, {useState} from 'react';

import {AI_LIMITS, thingNameProblem} from '../../domain/ai/aiKinds';
import {Note, ui} from '../cloud/wizardUi.jsx';

const SectionLabel = ({K, children}) => (
    <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: K.dim, margin: '12px 2px 6px'}}>
        {children}
    </div>
);

const examplesText = n => `${n} example${n === 1 ? '' : 's'}`;

const ThingRow = ({K, thing, count, selected, recording, onClick}) => {
    const enough = count >= AI_LIMITS.minExamples;
    const fill = Math.min(1, count / AI_LIMITS.minExamples);
    let sub = enough ? examplesText(count) : `${examplesText(count)} · needs ${AI_LIMITS.minExamples}`;
    if (recording) {
        sub = 'Recording…';
    }
    return (
        <button
            type="button"
            aria-pressed={selected}
            aria-label={`${thing.name}, ${sub}`}
            onClick={onClick}
            style={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                padding: '9px 10px',
                borderRadius: 10,
                border: `1px solid ${selected ? K.accent : 'transparent'}`,
                background: selected ? `${K.accent}1f` : 'transparent',
                color: K.text,
                cursor: 'pointer',
                fontFamily: 'inherit'
            }}
        >
            <span style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
                <span style={{flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {thing.name}
                </span>
                {enough ? <span aria-hidden="true" style={{color: K.green, fontWeight: 800, fontSize: 12}}>✓</span> : null}
            </span>
            <span style={{display: 'block', fontSize: 11, color: recording ? K.red : K.dim, margin: '2px 0 5px'}}>{sub}</span>
            <span aria-hidden="true" style={{display: 'block', height: 4, borderRadius: 2, background: K.border, overflow: 'hidden'}}>
                <span style={{display: 'block', height: '100%', width: `${fill * 100}%`, background: enough ? K.green : K.accent}} />
            </span>
        </button>
    );
};

const AddThing = ({K, things, placeholder, onAdd, startOpen}) => {
    const s = ui(K);
    const [open, setOpen] = useState(Boolean(startOpen));
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    if (things.length >= AI_LIMITS.maxThings) {
        return (
            <div style={Object.assign({}, s.small, {margin: '10px 2px 0'})}>
                {`${AI_LIMITS.maxThings} things is the most it can learn. Remove one to add another.`}
            </div>
        );
    }
    if (!open) {
        return (
            <button
                type="button"
                style={Object.assign({}, s.link, {margin: '10px 2px 0', fontSize: 13, textDecoration: 'none', fontWeight: 700})}
                onClick={() => setOpen(true)}
            >
                {'+ Add a thing'}
            </button>
        );
    }
    const submit = e => {
        e.preventDefault();
        const problem = thingNameProblem(name, things);
        if (problem) {
            setError(problem);
            return;
        }
        onAdd(name.trim());
        setName('');
        setError('');
        setOpen(things.length + 1 < AI_LIMITS.minThings);
    };
    return (
        <form onSubmit={submit} style={{marginTop: 10, display: 'grid', gap: 8}}>
            <label style={s.label} htmlFor="tb-new-thing">What should it learn to spot?</label>
            <input
                id="tb-new-thing"
                value={name}
                maxLength={AI_LIMITS.nameMax}
                autoFocus={!startOpen}
                placeholder={placeholder}
                onChange={e => {
                    setName(e.target.value);
                    setError('');
                }}
                style={s.input}
            />
            <div style={{display: 'flex', gap: 8}}>
                <button
                    type="submit"
                    style={{flex: 1, border: 'none', background: K.accent, color: '#fff', borderRadius: 9, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer'}}
                >
                    {'Add'}
                </button>
                {things.length ? (
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            setError('');
                        }}
                        style={{border: `1px solid ${K.border}`, background: K.surface, color: K.text, borderRadius: 9, padding: '8px 12px', fontSize: 13, cursor: 'pointer'}}
                    >
                        {'Cancel'}
                    </button>
                ) : null}
            </div>
            {error ? <div role="alert" style={{fontSize: 12, color: K.red}}>{error}</div> : null}
        </form>
    );
};

/**
 * Left side of the Edge AI page: the things the AI knows with how many examples each has,
 * "+ Add a thing", and the answers it always has.
 */
const ThingList = ({K, kind, things, counts, selected, recordingId, placeholder, onSelect, onAdd}) => (
    <nav
        aria-label="What the AI knows"
        style={{background: K.panel, border: `1px solid ${K.border}`, borderRadius: 14, padding: '6px 10px 14px'}}
    >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 2px 0'}}>
            <h2 style={{fontSize: 14, fontWeight: 800, color: K.text, margin: 0, flex: 1}}>What the AI knows</h2>
            <span style={{fontSize: 11, color: K.dim}}>{`${things.length} of ${AI_LIMITS.maxThings}`}</span>
        </div>

        {things.length ? <SectionLabel K={K}>Things you teach it</SectionLabel> : (
            <div style={Object.assign({}, ui(K).small, {margin: '10px 2px 0'})}>
                {`Add at least ${AI_LIMITS.minThings} things it should tell apart.`}
            </div>
        )}
        {things.map(t => (
            <ThingRow
                key={t.id}
                K={K}
                thing={t}
                count={counts[t.id] || 0}
                selected={selected === t.id}
                recording={recordingId === t.id}
                onClick={() => onSelect(t.id)}
            />
        ))}
        <AddThing K={K} things={things} placeholder={placeholder} onAdd={onAdd} startOpen={!things.length} />
        {things.length === 1 ? (
            <Note K={K} tone="blue" title="Add one more">It needs at least 2 things to tell apart.</Note>
        ) : null}

        <SectionLabel K={K}>Built in</SectionLabel>
        {kind !== 'sensors' ? (
            <div style={{fontSize: 12, color: K.sub, padding: '2px 2px 6px'}}>
                <b style={{color: K.text}}>Nothing</b>
                {': when the sensor is not moving'}
            </div>
        ) : null}
        <div style={{fontSize: 12, color: K.sub, padding: '2px 2px'}}>
            <b style={{color: K.text}}>Not sure</b>
            {': when it does not look like anything it learned'}
        </div>
    </nav>
);

export default ThingList;
