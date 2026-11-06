import React, {useState} from 'react';

import {COMPARE_OPS, buildSensorOptions, buildValueOptions} from '../../domain/condition';
import {blockMeta} from '../../domain/blockMeta';
import {useStudio} from '../../context/StudioContext.jsx';
import ModuleIcon from '../shared/ModuleIcon.jsx';

import FlowConnector from './FlowConnector.jsx';

const inputBase = {
    height: 32,
    border: 'none',
    borderRadius: 9,
    padding: '0 10px',
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
    background: '#fff',
    fontFamily: 'inherit',
    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)',
    minWidth: 0
};

const Word = ({children, fill}) => (
    <span
        style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: '20px',
            padding: '6px 0',
            minWidth: 0,
            flex: fill ? '1 1 120px' : '0 1 auto'
        }}
    >
        {children}
    </span>
);

const Part = ({children}) => (
    <span
        style={{
            fontSize: 14,
            fontWeight: 800,
            lineHeight: '24px',
            padding: '4px 9px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.22)',
            whiteSpace: 'nowrap'
        }}
    >
        {children}
    </span>
);

const Hint = ({children}) => (
    <span
        style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.22)'
        }}
    >
        {children}
    </span>
);

/** Number box that lets you type freely (empty, "0.") and only stores numbers it can use. */
const NumberField = ({value, fallback, min, max, step = 1, scale = 1, integer, width = 64, label, onChange}) => {
    const [draft, setDraft] = useState(null);
    const n = Number(value);
    const current = value === '' || value === null || typeof value === 'undefined' || !Number.isFinite(n) ?
        fallback :
        n;
    const shown = String(Math.round((current / scale) * 1000) / 1000);
    return (
        <input
            type="number"
            inputMode="decimal"
            aria-label={label}
            min={min / scale}
            max={max / scale}
            step={step}
            value={draft === null ? shown : draft}
            onFocus={e => e.target.select()}
            onChange={e => {
                const text = e.target.value;
                setDraft(text);
                const typed = Number(text);
                if (text !== '' && Number.isFinite(typed)) {
                    const scaled = Math.min(max, Math.max(min, typed * scale));
                    onChange(integer ? Math.round(scaled) : scaled);
                }
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            }}
            style={Object.assign({}, inputBase, {width, padding: '0 6px 0 10px'})}
        />
    );
};

const TextField = ({value, maxLength, label, onChange}) => {
    const text = value === null || typeof value === 'undefined' ? '' : String(value);
    return (
        <input
            type="text"
            aria-label={label}
            value={text}
            maxLength={maxLength}
            onChange={e => onChange(e.target.value)}
            style={Object.assign({}, inputBase, {
                width: `${Math.min(Math.max(text.length, 5), 18) + 3}ch`,
                maxWidth: '100%'
            })}
        />
    );
};

const Toggle = ({on, color, label, words, onChange}) => (
    <span
        role="group"
        aria-label={label}
        style={{
            display: 'inline-flex',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.22)',
            padding: 3,
            gap: 2
        }}
    >
        {[true, false].map(v => (
            <button
                key={String(v)}
                type="button"
                aria-pressed={on === v}
                onClick={() => onChange(v)}
                style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '0 14px',
                    height: 26,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: on === v ? '#fff' : 'transparent',
                    color: on === v ? color : 'rgba(255,255,255,0.9)'
                }}
            >
                {(words || ['On', 'Off'])[v ? 0 : 1]}
            </button>
        ))}
    </span>
);

const Choice = ({value, options, label, warn, onChange}) => (
    <select
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={Object.assign({}, inputBase, {
            padding: '0 4px 0 8px',
            cursor: 'pointer',
            maxWidth: 210,
            outline: warn ? '3px solid #fde047' : 'none'
        })}
    >
        {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
    </select>
);

/** 0..max shown as a 0–100% slider; codegen still receives the raw 0..max number. */
const Slider = ({value, max, label, onChange}) => {
    const raw = Number(value);
    const v = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : Math.round(max / 2);
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.22)'
            }}
        >
            <input
                type="range"
                aria-label={label}
                min={0}
                max={max}
                step={1}
                value={v}
                onChange={e => onChange(Number(e.target.value))}
                style={{width: 110, accentColor: '#fff', cursor: 'pointer'}}
            />
            <span style={{minWidth: 40, textAlign: 'right', fontSize: 14, fontWeight: 800}}>
                {`${Math.round((v / max) * 100)}%`}
            </span>
        </span>
    );
};

/** A slider that a template linked to a sensor ("follows Knob"), with a way back to the slider. */
const LinkedOrSlider = ({linked, linkedWord, values, value, max, label, onSlider, onUnlink}) => {
    if (!linked) {
        return <Slider value={value} max={max} label={label} onChange={onSlider} />;
    }
    const source = values.find(o => o.id === linked);
    return (
        <React.Fragment>
            <Word>{linkedWord}</Word>
            <Part>{source ? source.label : linked}</Part>
            <button
                type="button"
                onClick={onUnlink}
                style={{
                    border: '1px dashed rgba(255,255,255,0.6)',
                    background: 'transparent',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                }}
            >
                {'use a slider'}
            </button>
        </React.Fragment>
    );
};

const ValuePicker = ({value, options, onChange}) => {
    if (!options.length) {
        return <Hint>{'add a sensor in Build first'}</Hint>;
    }
    const known = options.some(o => o.id === value);
    const list = (known ? [] : [{value: '', label: 'pick a value', disabled: true}])
        .concat(options.map(o => ({value: o.id, label: o.label})));
    return <Choice value={known ? value : ''} options={list} label="Value" warn={!known} onChange={onChange} />;
};

const Condition = ({block, options, set}) => {
    const p = block.params || {};
    if (!options.length) {
        return (
            <React.Fragment>
                <Word>{'when'}</Word>
                <Hint>{'add a sensor in Build first'}</Hint>
            </React.Fragment>
        );
    }
    const selected = options.find(o => o.id === p.sensor);
    const pick = id => {
        const opt = options.find(o => o.id === id);
        if (!opt) {
            return;
        }
        if (opt.ai) {
            set({sensor: id, op: 'is', value: opt.choices[0].value});
            return;
        }
        if (opt.boolean) {
            set({sensor: id, op: 'is', value: 0});
            return;
        }
        set({
            sensor: id,
            op: opt.defaultOp || '<',
            value: opt.defaultValue === null || typeof opt.defaultValue === 'undefined' ? 0 : opt.defaultValue
        });
    };
    const sensorControl = options.length === 1 && selected ? (
        <Part>{selected.label}</Part>
    ) : (
        <Choice
            value={selected ? selected.id : ''}
            label="Sensor"
            warn={!selected}
            options={(selected ? [] : [{value: '', label: 'pick a sensor', disabled: true}])
                .concat(options.map(o => ({value: o.id, label: o.label})))}
            onChange={pick}
        />
    );
    if (selected && selected.ai) {
        const known = selected.choices.some(c => c.value === p.value);
        return (
            <React.Fragment>
                <Word>{'when'}</Word>
                {sensorControl}
                <Word>{selected.phrase}</Word>
                <Choice
                    value={known ? p.value : ''}
                    label="Answer"
                    warn={!known}
                    options={(known ? [] : [{value: '', label: 'pick an answer', disabled: true}])
                        .concat(selected.choices)}
                    onChange={v => set({value: v})}
                />
            </React.Fragment>
        );
    }
    if (!selected || selected.boolean) {
        return (
            <React.Fragment>
                <Word>{'when'}</Word>
                {sensorControl}
                {selected ? <Word>{selected.phrase}</Word> : null}
            </React.Fragment>
        );
    }
    const op = COMPARE_OPS.some(o => o.value === p.op) ? p.op : '<';
    return (
        <React.Fragment>
            <Word>{'when'}</Word>
            {sensorControl}
            <Choice
                value={op}
                label="Compare"
                options={COMPARE_OPS.map(o => ({value: o.value, label: o.words}))}
                onChange={v => set({op: v})}
            />
            <NumberField
                value={p.value}
                fallback={0}
                min={-100000}
                max={100000}
                step="any"
                width={80}
                label="Number"
                onChange={v => set({value: v})}
            />
            {selected.unit ? <Word>{selected.unit}</Word> : null}
            {selected.hint ? (
                <span style={{fontSize: 12, fontWeight: 600, opacity: 0.8}}>{`(${selected.hint})`}</span>
            ) : null}
        </React.Fragment>
    );
};

const plural = (n, one, many) => (Number(n) === 1 ? one : many);

/** Each block reads as one sentence with its settings inline. */
const Sentence = ({block, meta, ctx}) => {
    const p = block.params || {};
    const set = ctx.set;
    const part = meta.copies && ctx.setPart ? (
        <Choice
            value={block.cid}
            label="Which part"
            options={meta.copies}
            onChange={ctx.setPart}
        />
    ) : <Part>{meta.partName || meta.moduleName || ''}</Part>;
    const onOff = (key, label, words) => (
        <Toggle on={p[key] !== false} color={meta.color} label={label} words={words} onChange={v => set({[key]: v})} />
    );
    const messages = <Word>{'in Board messages'}</Word>;
    const say = text => <Word fill>{text}</Word>;

    switch (block.type) {
    case 'if_then':
        return <Condition block={block} options={ctx.sensors} set={set} />;
    case 'repeat':
        return (
            <React.Fragment>
                <Word>{'repeat'}</Word>
                <NumberField
                    value={p.count}
                    fallback={1}
                    min={0}
                    max={1000}
                    integer
                    label="Times"
                    onChange={v => set({count: v})}
                />
                <Word>{plural(p.count, 'time', 'times')}</Word>
            </React.Fragment>
        );
    case 'wait':
        return (
            <React.Fragment>
                <Word>{'wait'}</Word>
                <NumberField
                    value={p.seconds}
                    fallback={1}
                    min={0}
                    max={3600}
                    step={0.1}
                    width={72}
                    label="Seconds"
                    onChange={v => set({seconds: v})}
                />
                <Word>{plural(p.seconds, 'second', 'seconds')}</Word>
            </React.Fragment>
        );
    case 'set_on':
        if (meta.onOffWords) {
            return (
                <React.Fragment>
                    <Word>{'set'}</Word>{part}{onOff('on', meta.onOffWords.join(' or '), meta.onOffWords)}
                </React.Fragment>
            );
        }
        return <React.Fragment><Word>{'turn'}</Word>{part}{onOff('on', 'On or off')}</React.Fragment>;
    case 'turn_on':
    case 'turn_off':
        return <React.Fragment><Word>{'turn'}</Word>{part}<Word>{block.type === 'turn_on' ? 'on' : 'off'}</Word></React.Fragment>;
    case 'set_brightness':
        return (
            <React.Fragment>
                <Word>{'set'}</Word>{part}<Word>{'brightness'}</Word>
                <LinkedOrSlider
                    linked={p.brightnessVar}
                    linkedWord="to follow"
                    values={ctx.values}
                    value={p.brightness}
                    max={255}
                    label="Brightness"
                    onSlider={v => set({brightness: v})}
                    onUnlink={() => set({brightnessVar: ''})}
                />
            </React.Fragment>
        );
    case 'blink':
        return (
            <React.Fragment>
                <Word>{'blink'}</Word>{part}<Word>{'on and off,'}</Word>
                <NumberField
                    value={p.ms}
                    fallback={500}
                    min={20}
                    max={60000}
                    step={0.1}
                    scale={1000}
                    width={72}
                    label="Seconds"
                    onChange={v => set({ms: Math.round(v)})}
                />
                <Word>{'sec each'}</Word>
            </React.Fragment>
        );
    case 'beep':
        return (
            <React.Fragment>
                <Word>{'beep'}</Word>{part}<Word>{'for'}</Word>
                <NumberField
                    value={p.ms}
                    fallback={200}
                    min={20}
                    max={10000}
                    step={0.1}
                    scale={1000}
                    width={72}
                    label="Seconds"
                    onChange={v => set({ms: Math.round(v)})}
                />
                <Word>{'sec'}</Word>
            </React.Fragment>
        );
    case 'play_tone':
        return (
            <React.Fragment>
                <Word>{'beep at'}</Word>
                <NumberField
                    value={p.freq}
                    fallback={1000}
                    min={31}
                    max={20000}
                    integer
                    width={80}
                    label="Pitch"
                    onChange={v => set({freq: v})}
                />
                <Word>{'Hz'}</Word>
            </React.Fragment>
        );
    case 'stop_tone':
        return say('stop the beep');
    case 'set_angle':
        return (
            <React.Fragment>
                <Word>{'turn'}</Word>{part}<Word>{'to'}</Word>
                <NumberField
                    value={p.angle}
                    fallback={90}
                    min={0}
                    max={180}
                    integer
                    label="Angle"
                    onChange={v => set({angle: v})}
                />
                <Word>{'degrees'}</Word>
            </React.Fragment>
        );
    case 'motor_speed':
        return (
            <React.Fragment>
                <Word>{'spin'}</Word>{part}
                <Choice
                    value={p.motor === 'B' ? 'B' : 'A'}
                    label="Which motor"
                    options={[{value: 'A', label: 'A'}, {value: 'B', label: 'B'}]}
                    onChange={v => set({motor: v})}
                />
                <Choice
                    value={p.dir === 'backward' ? 'backward' : 'forward'}
                    label="Direction"
                    options={[{value: 'forward', label: 'forward'}, {value: 'backward', label: 'backward'}]}
                    onChange={v => set({dir: v})}
                />
                {p.speedVar ? null : <Word>{'at'}</Word>}
                <LinkedOrSlider
                    linked={p.speedVar}
                    linkedWord="with speed from"
                    values={ctx.values}
                    value={p.speed}
                    max={255}
                    label="Speed"
                    onSlider={v => set({speed: v})}
                    onUnlink={() => set({speedVar: ''})}
                />
            </React.Fragment>
        );
    case 'motor_stop':
        return say('stop all motors');
    case 'relay_channel':
        return (
            <React.Fragment>
                <Word>{'set switch'}</Word>
                <Choice
                    value={String(p.channel || 1)}
                    label="Switch number"
                    options={[1, 2, 3, 4].map(n => ({value: String(n), label: String(n)}))}
                    onChange={v => set({channel: Number(v)})}
                />
                <Word>{'of'}</Word>{part}<Word>{'to'}</Word>{onOff('on', 'On or off')}
            </React.Fragment>
        );
    case 'relay_all':
        return (
            <React.Fragment>
                <Word>{'set every switch of'}</Word>{part}<Word>{'to'}</Word>{onOff('on', 'On or off')}
            </React.Fragment>
        );
    case 'stepper_move':
        return (
            <React.Fragment>
                <Word>{'turn'}</Word>{part}
                <NumberField
                    value={p.steps}
                    fallback={100}
                    min={-10000}
                    max={10000}
                    integer
                    width={84}
                    label="Steps"
                    onChange={v => set({steps: v})}
                />
                <Word>{'steps at speed'}</Word>
                <NumberField
                    value={p.rpm}
                    fallback={12}
                    min={1}
                    max={60}
                    integer
                    width={60}
                    label="Speed"
                    onChange={v => set({rpm: v})}
                />
            </React.Fragment>
        );
    case 'show_text':
        return (
            <React.Fragment>
                <Word>{'show'}</Word>
                <TextField value={p.text} maxLength={40} label="Text" onChange={v => set({text: v})} />
                <Word>{'on'}</Word>{part}
            </React.Fragment>
        );
    case 'show_number':
        return (
            <React.Fragment>
                <Word>{'show'}</Word>
                <ValuePicker value={p.varName} options={ctx.values} onChange={v => set({varName: v})} />
                <Word>{'on'}</Word>{part}
            </React.Fragment>
        );
    case 'serial_print':
        return (
            <React.Fragment>
                <Word>{'write'}</Word>
                <TextField value={p.text} maxLength={60} label="Text" onChange={v => set({text: v})} />
                {messages}
            </React.Fragment>
        );
    case 'serial_var':
        return (
            <React.Fragment>
                <Word>{'write'}</Word>
                <ValuePicker value={p.varName} options={ctx.values} onChange={v => set({varName: v})} />
                {messages}
            </React.Fragment>
        );
    case 'print_gas':
        return say('write the gas level in Board messages');
    case 'print_soil':
        return say('write the soil moisture in Board messages');
    case 'print_climate':
        return say('write temperature and humidity in Board messages');
    case 'rfid_read':
        return <React.Fragment><Word>{'check'}</Word>{part}<Word>{'for a card'}</Word></React.Fragment>;
    case 'ble_advertise':
        return (
            <React.Fragment>
                <Word>{'turn on Bluetooth as'}</Word>
                <TextField value={p.name} maxLength={20} label="Bluetooth name" onChange={v => set({name: v})} />
            </React.Fragment>
        );
    case 'ble_send':
    case 'hc05_send':
        return (
            <React.Fragment>
                <Word>{'send'}</Word>
                <TextField
                    value={p.text}
                    maxLength={block.type === 'ble_send' ? 20 : 60}
                    label="Message"
                    onChange={v => set({text: v})}
                />
                <Word>{'over Bluetooth'}</Word>
            </React.Fragment>
        );
    case 'hc05_read':
        return say('check for a Bluetooth message');
    case 'cloud_alert':
        return (
            <React.Fragment>
                <Word>{'send alert'}</Word>
                <TextField value={p.text} maxLength={120} label="Alert message" onChange={v => set({text: v})} />
                <Word>{'to phone'}</Word>
            </React.Fragment>
        );
    case 'cloud_send_now':
        return say('send readings to Cloud now');
    case 'is_pressed':
    case 'is_motion':
    case 'is_detected':
        return <React.Fragment><Word>{'check'}</Word>{part}</React.Fragment>;
    case 'read_value':
    case 'read_distance':
    case 'read_temp':
    case 'read_humidity':
    case 'read_motion':
        return <React.Fragment><Word>{'read'}</Word>{part}</React.Fragment>;
    default:
        return say(meta.label);
    }
};

const IconTile = ({iconId}) => (
    <span
        style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'rgba(255,255,255,0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }}
    >
        {iconId ? <ModuleIcon id={iconId} color="#fff" size={16} /> : null}
    </span>
);

const Line = ({iconId, children}) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px 8px',
            padding: '10px 16px 10px 10px',
            minHeight: 52
        }}
    >
        <IconTile iconId={iconId} />
        {children}
    </div>
);

const DeleteBadge = ({onClick, inside}) => (
    <button
        type="button"
        className="tb-del"
        aria-label="Delete block"
        title={inside ? 'Delete this block and everything inside it' : 'Delete this block'}
        onClick={onClick}
        style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '2px solid #fff',
            background: '#1f2937',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 3,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}
    >
        {'×'}
    </button>
);

const BranchArrow = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{display: 'block'}}>
        <path
            d="M2 1v5a2 2 0 002 2h6M7.5 5.5L10 8l-2.5 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/** Full drop zone while a lane is empty or chosen; otherwise a small "+ add" pill. */
const AddSlot = ({active, compact, K, onClick}) => {
    if (compact && !active) {
        return (
            <button
                type="button"
                onClick={onClick}
                title="Add a block here"
                style={{
                    alignSelf: 'flex-start',
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 999,
                    border: `1px dashed ${K.dim}`,
                    background: 'transparent',
                    color: K.dim,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                }}
            >
                {'+ add'}
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            style={{
                width: '100%',
                minHeight: 40,
                border: `2px dashed ${active ? K.accent : `${K.dim}99`}`,
                background: active ? `${K.accent}1f` : 'transparent',
                color: active ? K.accent : K.dim,
                borderRadius: 12,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
            }}
        >
            {active ? '← Now pick a block on the left' : '+ add a block here'}
        </button>
    );
};

const Lane = ({title, blocks, depth, active, K, onAdd}) => (
    <div style={{margin: '0 12px 0 22px'}}>
        {title ? (
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    opacity: 0.95,
                    margin: '2px 0 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                }}
            >
                <BranchArrow />
                {title}
            </div>
        ) : null}
        <div
            style={{
                borderRadius: 12,
                background: K.canvas,
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.18)',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                color: K.text
            }}
        >
            {blocks.map((child, index) => (
                <React.Fragment key={child.uid}>
                    {index > 0 ? <FlowConnector tone={K.dim} /> : null}
                    <ProgramBlock block={child} depth={depth + 1} />
                </React.Fragment>
            ))}
            {blocks.length ? <div style={{height: 8}} /> : null}
            <AddSlot active={active} compact={blocks.length > 0} K={K} onClick={onAdd} />
        </div>
    </div>
);

const ProgramBlock = ({block, depth = 0}) => {
    const {connections, ai, deleteBlock, updateParam, setBlockPart, setAddTarget, addTarget, K} = useStudio();
    const meta = blockMeta(block, connections, K);
    const isContainer = block.type === 'repeat' || block.type === 'if_then';
    const isIf = block.type === 'if_then';
    const targetChildren = Boolean(addTarget && addTarget.parentId === block.uid && addTarget.branch !== 'else');
    const targetElse = Boolean(addTarget && addTarget.parentId === block.uid && addTarget.branch === 'else');
    const children = block.children || [];
    const elseChildren = block.elseChildren || [];
    const showElse = isIf && (elseChildren.length > 0 || targetElse);
    const ctx = {
        set: patch => updateParam(block.uid, patch),
        setPart: setBlockPart ? cid => setBlockPart(block.uid, cid) : null,
        sensors: buildSensorOptions(connections, ai),
        values: buildValueOptions(connections)
    };
    const toggleTarget = (branch, active) => setAddTarget(active ? null : {parentId: block.uid, branch});

    return (
        <div style={{animation: depth === 0 ? 'tbSlideIn 0.2s ease' : undefined}}>
            <div
                className="tb-block"
                style={{
                    position: 'relative',
                    borderRadius: isContainer ? 16 : 14,
                    background: meta.color,
                    color: '#fff',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.22), 0 6px 14px rgba(0,0,0,0.14)',
                    outline: meta.kind === 'orphan' || meta.kind === 'unknown' ? '2px dashed rgba(255,255,255,0.7)' : 'none',
                    outlineOffset: -4,
                    paddingBottom: isContainer ? 12 : 0
                }}
            >
                <Line iconId={meta.iconId}>
                    <Sentence block={block} meta={meta} ctx={ctx} />
                </Line>
                {meta.kind === 'orphan' || meta.kind === 'unknown' ? (
                    <div style={{padding: '0 14px 10px 52px', fontSize: 12, fontWeight: 700, opacity: 0.95}}>
                        {meta.kind === 'orphan' ?
                            `The ${meta.moduleName} is not on the board. Add it in Build, or delete this block.` :
                            'This block is not supported here. Delete it to keep going.'}
                    </div>
                ) : null}
                {isContainer ? (
                    <Lane
                        title={isIf ? 'then' : null}
                        blocks={children}
                        depth={depth}
                        active={targetChildren}
                        K={K}
                        onAdd={() => toggleTarget('children', targetChildren)}
                    />
                ) : null}
                {showElse ? (
                    <div style={{marginTop: 10}}>
                        <Lane
                            title="otherwise"
                            blocks={elseChildren}
                            depth={depth}
                            active={targetElse}
                            K={K}
                            onAdd={() => toggleTarget('else', targetElse)}
                        />
                    </div>
                ) : null}
                {isIf && !showElse ? (
                    <button
                        type="button"
                        title="Add blocks that run when this is not true"
                        onClick={() => toggleTarget('else', false)}
                        style={{
                            margin: '10px 10px 0 22px',
                            border: '1px dashed rgba(255,255,255,0.6)',
                            background: 'transparent',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '5px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {'+ otherwise…'}
                    </button>
                ) : null}
                <DeleteBadge inside={isContainer && (children.length + elseChildren.length) > 0} onClick={() => deleteBlock(block.uid)} />
            </div>
        </div>
    );
};

export default ProgramBlock;
