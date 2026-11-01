import React, {useState} from 'react';

import {READING_KEY_RE, prettyKey} from '../format';
import {MAX_COLS, MAX_ROWS, clampSpan, minSpan, sizeFromW, spanOf, tileHeight, typeDefaultSpan} from '../grid';
import {MAX_WIDGETS, READING_LOOKS, TYPES, keysFor, typeSpec} from '../widgetTypes';
import {Button, Field, inputStyle, useTheme} from '../ui.jsx';

const numOrNull = text => {
    if (text === '' || text === null || text === undefined) {
        return null;
    }
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
};

const Segmented = ({value, options, onChange, label}) => {
    const K = useTheme();
    return (
        <div role="group" aria-label={label} style={{display: 'flex', gap: 4, background: K.canvas, border: `1px solid ${K.border}`, borderRadius: 10, padding: 3}}>
            {options.map(o => (
                <button
                    key={o.id}
                    type="button"
                    aria-pressed={o.id === value}
                    onClick={() => onChange(o.id)}
                    style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 6px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: o.id === value ? K.accent : 'transparent',
                        color: o.id === value ? '#fff' : K.sub
                    }}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
};

const Stepper = ({label, value, min, max, onChange, unit, lessLabel, moreLabel}) => {
    const K = useTheme();
    const step = d => onChange(Math.min(max, Math.max(min, value + d)));
    const btn = (text, d, disabled, aria) => (
        <button
            type="button"
            aria-label={aria}
            disabled={disabled}
            onClick={() => step(d)}
            style={{
                width: 36,
                height: 36,
                border: `1px solid ${K.border}`,
                borderRadius: 10,
                background: K.surface,
                color: K.text,
                fontSize: 18,
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1
            }}
        >
            {text}
        </button>
    );
    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: K.muted, fontWeight: 700, flex: 1}}>
            {label}
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                {btn('−', -1, value <= min, lessLabel)}
                <span style={{minWidth: 46, textAlign: 'center', color: K.text, fontSize: 14}}>{value} {unit}</span>
                {btn('+', 1, value >= max, moreLabel)}
            </div>
        </div>
    );
};

const PanelShell = ({title, onClose, sheet, children}) => {
    const K = useTheme();
    const base = {
        background: K.panel,
        border: `1px solid ${K.border}`,
        boxSizing: 'border-box',
        overflowY: 'auto'
    };
    const style = sheet ? Object.assign(base, {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '62vh',
        zIndex: 20,
        borderRadius: '16px 16px 0 0',
        borderBottom: 'none',
        padding: 14,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)'
    }) : Object.assign(base, {
        width: 320,
        flexShrink: 0,
        position: 'sticky',
        top: 66,
        alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 82px)',
        borderRadius: 14,
        padding: 14
    });
    return (
        <aside aria-label={title} style={style}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12}}>
                <div style={{flex: 1, fontSize: 15, fontWeight: 800, color: K.text}}>{title}</div>
                <Button kind="ghost" onClick={onClose} aria-label="Close panel" style={{padding: '4px 10px', minHeight: 30}}>✕</Button>
            </div>
            {children}
        </aside>
    );
};

/** The widget exactly as it will look on the board, with live data and controls switched off. */
const Preview = ({widget, renderBody}) => {
    const K = useTheme();
    const span = spanOf(widget);
    return (
        <div>
            <div style={{fontSize: 11, fontWeight: 700, color: K.dim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4}}>
                Preview
            </div>
            <div
                style={{
                    height: tileHeight(span.h),
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 14,
                    background: K.canvas,
                    border: `1px solid ${K.border}`,
                    borderRadius: 14,
                    overflow: 'hidden'
                }}
            >
                <div style={{fontSize: 12, fontWeight: 700, color: K.muted, marginBottom: 8, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {widget.title || prettyKey(widget.key) || widget.type}
                </div>
                <div style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    {renderBody(widget)}
                </div>
            </div>
        </div>
    );
};

const EditPanel = ({widget, index, count, readingKeys, cols, renderBody, onChange, onRemove, onMove, onClose, sheet}) => {
    const K = useTheme();
    const spec = typeSpec(widget.type);
    const isReading = spec.needs === 'reading';
    const span = spanOf(widget);
    const min = minSpan(widget.type);
    const opts = widget.options || {};
    const keys = keysFor(spec.needs, readingKeys);
    const hasKey = Boolean(spec.needs);

    const setOptions = patch => onChange({options: Object.assign({min: null, max: null, unit: ''}, opts, patch)});
    const setSpan = (w, h) => {
        const next = clampSpan(widget.type, w, h, cols);
        onChange({w: next.w, h: next.h, size: sizeFromW(next.w)});
    };
    const changeLook = type => {
        if (type === widget.type) {
            return;
        }
        const oldDef = typeDefaultSpan(widget.type);
        const wasDefault = span.w === oldDef.w && span.h === oldDef.h;
        const target = wasDefault ? typeDefaultSpan(type) : span;
        // Not limited to the columns visible right now: editing on a phone must not shrink a widget for good.
        const next = clampSpan(type, target.w, target.h);
        onChange({type, w: next.w, h: next.h, size: sizeFromW(next.w)});
    };
    const changeKey = key => {
        const auto = !widget.title || widget.title === prettyKey(widget.key);
        onChange(auto ? {key, title: prettyKey(key)} : {key});
    };

    return (
        <PanelShell title={`Edit ${spec.label.toLowerCase()}`} onClose={onClose} sheet={sheet}>
            <div style={{display: 'grid', gap: 14}}>
                <Preview widget={widget} renderBody={renderBody} />

                <Field label="Title">
                    <input
                        value={widget.title}
                        maxLength={40}
                        placeholder={prettyKey(widget.key) || spec.label}
                        onChange={e => onChange({title: e.target.value})}
                        style={inputStyle(K)}
                    />
                </Field>

                {hasKey ? (
                    <Field label={isReading ? 'Shows' : 'Controls'}>
                        <select value={widget.key || ''} onChange={e => changeKey(e.target.value)} style={inputStyle(K)}>
                            {widget.key && keys.indexOf(widget.key) < 0 ? <option value={widget.key}>{prettyKey(widget.key)} (no data yet)</option> : null}
                            {keys.map(k => <option key={k} value={k}>{prettyKey(k)}</option>)}
                        </select>
                    </Field>
                ) : null}

                {isReading ? (
                    <div>
                        <div style={{fontSize: 12, fontWeight: 700, color: K.muted, marginBottom: 4}}>Look</div>
                        <Segmented
                            label="Look"
                            value={widget.type}
                            onChange={changeLook}
                            options={READING_LOOKS.map(id => ({id, label: typeSpec(id).label}))}
                        />
                    </div>
                ) : null}

                <div>
                    <div style={{fontSize: 12, fontWeight: 700, color: K.muted, marginBottom: 4}}>Size (tiles)</div>
                    <div style={{display: 'flex', gap: 12}}>
                        <Stepper
                            label="Width"
                            lessLabel="Narrower"
                            moreLabel="Wider"
                            value={Math.min(span.w, cols)}
                            min={min.w}
                            max={Math.min(cols, MAX_COLS)}
                            onChange={w => setSpan(w, span.h)}
                        />
                        <Stepper
                            label="Height"
                            lessLabel="Shorter"
                            moreLabel="Taller"
                            value={span.h}
                            min={min.h}
                            max={MAX_ROWS}
                            onChange={h => setSpan(span.w, h)}
                        />
                    </div>
                    <div style={{fontSize: 11, color: K.dim, marginTop: 6}}>Or drag the corner of the tile on the board.</div>
                </div>

                {isReading ? (
                    <Field label="Unit" hint="Shown after the number, like °C or %">
                        <input
                            value={opts.unit || ''}
                            maxLength={8}
                            onChange={e => setOptions({unit: e.target.value})}
                            style={Object.assign(inputStyle(K), {width: 110})}
                        />
                    </Field>
                ) : null}

                {widget.type === 'gauge' ? (
                    <div style={{display: 'flex', gap: 12}}>
                        <Field label="Minimum">
                            <input
                                type="number"
                                value={opts.min === null || opts.min === undefined ? '' : opts.min}
                                placeholder="0"
                                onChange={e => setOptions({min: numOrNull(e.target.value)})}
                                style={Object.assign(inputStyle(K), {width: '100%'})}
                            />
                        </Field>
                        <Field label="Maximum">
                            <input
                                type="number"
                                value={opts.max === null || opts.max === undefined ? '' : opts.max}
                                placeholder="100"
                                onChange={e => setOptions({max: numOrNull(e.target.value)})}
                                style={Object.assign(inputStyle(K), {width: '100%'})}
                            />
                        </Field>
                    </div>
                ) : null}

                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
                    <Button disabled={index === 0} onClick={() => onMove(-1)} style={{padding: '6px 10px', minHeight: 34}}>← Earlier</Button>
                    <Button disabled={index === count - 1} onClick={() => onMove(1)} style={{padding: '6px 10px', minHeight: 34}}>Later →</Button>
                    <div style={{flex: 1}} />
                    <Button kind="ghost" onClick={onRemove} style={{color: K.red}}>Remove</Button>
                </div>
                <Button kind="primary" onClick={onClose}>Done</Button>
            </div>
        </PanelShell>
    );
};

const AddPanel = ({readingKeys, usedKeys, onAdd, onClose, sheet, full}) => {
    const K = useTheme();
    const [type, setType] = useState(null);
    const [custom, setCustom] = useState('');
    const spec = type ? typeSpec(type) : null;
    const keys = spec ? keysFor(spec.needs, readingKeys) : [];
    const [key, setKey] = useState('');
    const chosen = key || keys[0] || '';
    const needsCustom = Boolean(spec && spec.needs === 'reading' && !keys.length);
    const finalKey = needsCustom ? custom.trim() : chosen;
    const customOk = !needsCustom || READING_KEY_RE.test(finalKey);

    const pick = id => {
        const s = typeSpec(id);
        if (!s.needs) {
            onAdd(id, null);
            return;
        }
        setType(id);
        setKey('');
        setCustom('');
    };

    return (
        <PanelShell title="Add a widget" onClose={onClose} sheet={sheet}>
            {full ? (
                <div style={{fontSize: 13, color: K.sub}}>A dashboard holds up to {MAX_WIDGETS} widgets. Remove one to add another.</div>
            ) : null}
            {!full && !type ? (
                <div style={{display: 'grid', gap: 8}}>
                    {TYPES.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => pick(t.id)}
                            style={{
                                textAlign: 'left',
                                background: K.canvas,
                                border: `1px solid ${K.border}`,
                                borderRadius: 12,
                                padding: '10px 12px',
                                cursor: 'pointer',
                                color: K.text,
                                fontFamily: 'inherit'
                            }}
                        >
                            <div style={{fontWeight: 800, fontSize: 14}}>{t.label}</div>
                            <div style={{fontSize: 12, color: K.dim, marginTop: 2}}>{t.blurb}</div>
                        </button>
                    ))}
                </div>
            ) : null}
            {!full && type ? (
                <div style={{display: 'grid', gap: 12}}>
                    <div style={{fontWeight: 800, color: K.text}}>{spec.label}</div>
                    {needsCustom ? (
                        <Field
                            label="Reading name"
                            hint="No readings yet. Type the name your program sends, like temperature. Letters and numbers only."
                        >
                            <input
                                value={custom}
                                maxLength={32}
                                onChange={e => setCustom(e.target.value)}
                                style={inputStyle(K)}
                            />
                        </Field>
                    ) : (
                        <Field label={spec.needs === 'reading' ? 'Shows' : 'Controls'}>
                            <select value={chosen} onChange={e => setKey(e.target.value)} style={inputStyle(K)}>
                                {keys.map(k => (
                                    <option key={k} value={k}>
                                        {prettyKey(k)}{usedKeys.indexOf(`${spec.id}:${k}`) >= 0 ? ' (already on the board)' : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    <div style={{display: 'flex', gap: 8}}>
                        <Button onClick={() => setType(null)}>Back</Button>
                        <Button kind="primary" disabled={!finalKey || !customOk} onClick={() => onAdd(type, finalKey)}>Add</Button>
                    </div>
                </div>
            ) : null}
        </PanelShell>
    );
};

export {AddPanel, EditPanel};
