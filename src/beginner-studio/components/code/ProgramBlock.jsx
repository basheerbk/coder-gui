import React from 'react';

import {COMPARE_OPS, buildSensorOptions} from '../../domain/condition';
import {blockMeta} from '../../domain/blockMeta';
import {useStudio} from '../../context/StudioContext.jsx';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const PARAM_FIELDS = {
    wait: [{key: 'seconds', label: 's', type: 'number'}],
    repeat: [{key: 'count', label: 'times', type: 'number'}],
    if_then: [], // custom ConditionPicker
    set_on: [{key: 'on', label: 'power', type: 'toggle'}],
    play_tone: [{key: 'freq', label: 'Hz', type: 'number'}],
    set_angle: [{key: 'angle', label: '°', type: 'number'}],
    motor_speed: [{key: 'speed', label: 'spd', type: 'number'}],
    show_text: [{key: 'text', label: 'txt', type: 'text'}],
    serial_print: [{key: 'text', label: 'txt', type: 'text'}],
    show_number: [{key: 'varName', label: 'var', type: 'text'}],
    serial_var: [{key: 'varName', label: 'var', type: 'text'}],
    blink: [{key: 'ms', label: 'ms', type: 'number'}]
};

const chipSelect = {
    border: 'none',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 800,
    color: '#111',
    background: '#fff',
    cursor: 'pointer',
    maxWidth: 140
};

const ConditionPicker = ({block, connections, updateParam}) => {
    const options = buildSensorOptions(connections);
    const sensor = block.params.sensor || '';
    const selected = options.find(o => o.id === sensor) || options[0];
    const isBool = selected ? selected.boolean : false;
    const op = block.params.op === 'is' || isBool ? 'is' : (block.params.op || '<');
    const value = block.params.value == null ? 500 : block.params.value;

    const setSensor = id => {
        const opt = options.find(o => o.id === id);
        if (!opt) {
            return;
        }
        if (opt.boolean) {
            updateParam(block.uid, {sensor: id, op: 'is', value: 0});
        } else {
            updateParam(block.uid, {
                sensor: id,
                op: op === 'is' ? '<' : op,
                value: Number(value) || 0
            });
        }
    };

    if (!options.length) {
        return (
            <span style={{fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)'}}>
                Wire a sensor first
            </span>
        );
    }

    return (
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap'}}>
            <span style={{fontSize: 11, fontWeight: 800, color: '#fff'}}>when</span>
            <select
                value={selected ? selected.id : ''}
                onChange={e => setSensor(e.target.value)}
                style={chipSelect}
            >
                {options.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
            {isBool ? (
                <span style={{fontSize: 11, fontWeight: 800, color: '#fff'}}>is true</span>
            ) : (
                <React.Fragment>
                    <select
                        value={op}
                        onChange={e => updateParam(block.uid, {op: e.target.value})}
                        style={Object.assign({}, chipSelect, {maxWidth: 56, padding: '4px 4px'})}
                    >
                        {COMPARE_OPS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={value}
                        onChange={e => updateParam(block.uid, {value: Number(e.target.value)})}
                        style={Object.assign({}, chipSelect, {width: 64, cursor: 'text'})}
                    />
                </React.Fragment>
            )}
        </div>
    );
};

const PortDot = ({color, top}) => (
    <div
        style={{
            position: 'absolute',
            left: '50%',
            [top ? 'top' : 'bottom']: -5,
            transform: 'translateX(-50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${color}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            zIndex: 2,
            pointerEvents: 'none'
        }}
    />
);

const Edge = ({color}) => (
    <div
        style={{
            width: 2,
            height: 14,
            margin: '0 auto',
            background: `linear-gradient(180deg, ${color}aa, ${color}44)`,
            borderRadius: 2,
            flexShrink: 0
        }}
    />
);

const NestSlot = ({active, accent, label, onClick}) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            border: `1.5px dashed ${active ? accent : 'rgba(255,255,255,0.45)'}`,
            background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 8px',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            letterSpacing: 0.3
        }}
    >
        {label}
    </button>
);

const NodeCard = ({meta, fields, block, updateParam, deleteBlock, children}) => (
    <div
        style={{
            position: 'relative',
            borderRadius: 14,
            background: meta.color,
            border: 'none',
            boxShadow: `0 4px 0 ${meta.color}99, 0 6px 16px rgba(0,0,0,0.2)`,
            overflow: 'visible',
            color: '#fff'
        }}
    >
        <PortDot color={meta.color} top />
        <div style={{padding: '10px 12px', minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <div
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}
                >
                    {meta.iconId ? <ModuleIcon id={meta.iconId} color="#fff" size={14} /> : null}
                </div>
                <span style={{fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, minWidth: 0, lineHeight: 1.25}}>
                    {meta.label}
                </span>
                <button
                    type="button"
                    onClick={() => deleteBlock(block.uid)}
                    aria-label="Delete node"
                    style={{
                        border: 'none',
                        background: 'rgba(0,0,0,0.22)',
                        color: '#fff',
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0
                    }}
                >
                    ×
                </button>
            </div>
            {fields.length ? (
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8}}>
                    {fields.map(field => {
                        if (field.type === 'toggle') {
                            const on = block.params[field.key] !== false;
                            return (
                                <div
                                    key={field.key}
                                    style={{
                                        display: 'inline-flex',
                                        borderRadius: 999,
                                        background: 'rgba(0,0,0,0.2)',
                                        padding: 2,
                                        gap: 2
                                    }}
                                >
                                    {[
                                        {value: true, label: 'On'},
                                        {value: false, label: 'Off'}
                                    ].map(opt => (
                                        <button
                                            key={String(opt.value)}
                                            type="button"
                                            onClick={() => updateParam(block.uid, {[field.key]: opt.value})}
                                            style={{
                                                border: 'none',
                                                borderRadius: 999,
                                                padding: '4px 12px',
                                                fontSize: 11,
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                background: on === opt.value ? '#fff' : 'transparent',
                                                color: on === opt.value ? meta.color : 'rgba(255,255,255,0.85)'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            );
                        }
                        return (
                            <label
                                key={field.key}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#fff',
                                    background: 'rgba(0,0,0,0.18)',
                                    borderRadius: 999,
                                    padding: '3px 8px 3px 10px'
                                }}
                            >
                                <span>{field.label}</span>
                                <input
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    value={block.params[field.key] == null ? '' : block.params[field.key]}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        updateParam(block.uid, {
                                            [field.key]: field.type === 'number' ? Number(raw) : raw
                                        });
                                    }}
                                    style={{
                                        width: field.type === 'text' ? 88 : 52,
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '2px 6px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#111',
                                        background: '#fff'
                                    }}
                                />
                            </label>
                        );
                    })}
                </div>
            ) : null}
            {children}
        </div>
        <PortDot color={meta.color} top={false} />
    </div>
);

const BranchColumn = ({
    title,
    accent,
    blocks,
    depth,
    active,
    onAdd
}) => (
    <div style={{flex: 1, minWidth: 0}}>
        {title ? (
            <div
                style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    color: 'rgba(255,255,255,0.9)',
                    marginBottom: 6,
                    textTransform: 'uppercase'
                }}
            >
                {title}
            </div>
        ) : null}
        <div
            style={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(0,0,0,0.16)',
                padding: '10px 8px',
                minHeight: 48
            }}
        >
            {blocks.map((child, index) => (
                <React.Fragment key={child.uid}>
                    {index > 0 ? <Edge color="#fff" /> : null}
                    <ProgramBlock block={child} depth={depth + 1} />
                </React.Fragment>
            ))}
            {blocks.length > 0 ? <Edge color="#fff" /> : null}
            <NestSlot
                active={active}
                accent={accent}
                label={title === 'Else' ? '+ otherwise' : '+ inside'}
                onClick={onAdd}
            />
        </div>
    </div>
);

const ProgramBlock = ({block, depth = 0}) => {
    const {connections, deleteBlock, updateParam, setAddTarget, addTarget, K} = useStudio();
    const meta = blockMeta(block, connections, K);
    const fields = PARAM_FIELDS[block.type] || [];
    const isContainer = block.type === 'repeat' || block.type === 'if_then';
    const targetChildren = addTarget && addTarget.parentId === block.uid && addTarget.branch !== 'else';
    const targetElse = addTarget && addTarget.parentId === block.uid && addTarget.branch === 'else';
    const children = block.children || [];
    const elseChildren = block.elseChildren || [];

    if (!isContainer) {
        return (
            <div style={{animation: depth === 0 ? 'tbSlideIn 0.2s ease' : undefined}}>
                <NodeCard
                    meta={meta}
                    fields={fields}
                    block={block}
                    updateParam={updateParam}
                    deleteBlock={deleteBlock}
                />
            </div>
        );
    }

    return (
        <div style={{animation: depth === 0 ? 'tbSlideIn 0.2s ease' : undefined}}>
            <div
                style={{
                    position: 'relative',
                    borderRadius: 16,
                    background: meta.color,
                    border: 'none',
                    boxShadow: `0 5px 0 ${meta.color}99, 0 8px 18px rgba(0,0,0,0.22)`,
                    overflow: 'visible',
                    color: '#fff'
                }}
            >
                <PortDot color={meta.color} top />
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <div
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ModuleIcon id={meta.iconId} color="#fff" size={14} />
                    </div>
                    {block.type === 'if_then' ? null : (
                        <span style={{fontSize: 12, fontWeight: 800, color: '#fff', flex: 1}}>{meta.label}</span>
                    )}
                    {block.type === 'if_then' ? (
                        <div style={{flex: 1, minWidth: 0}}>
                            <ConditionPicker
                                block={block}
                                connections={connections}
                                updateParam={updateParam}
                            />
                        </div>
                    ) : fields.map(field => (
                        <label
                            key={field.key}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#fff',
                                background: 'rgba(0,0,0,0.18)',
                                borderRadius: 999,
                                padding: '3px 8px 3px 10px'
                            }}
                        >
                            <span>{field.label}</span>
                            <input
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={block.params[field.key] == null ? '' : block.params[field.key]}
                                onChange={e => {
                                    const raw = e.target.value;
                                    updateParam(block.uid, {
                                        [field.key]: field.type === 'number' ? Number(raw) : raw
                                    });
                                }}
                                style={{
                                    width: field.type === 'text' ? 100 : 48,
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '2px 6px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#111',
                                    background: '#fff'
                                }}
                            />
                        </label>
                    ))}
                    <button
                        type="button"
                        onClick={() => deleteBlock(block.uid)}
                        aria-label="Delete node"
                        style={{
                            border: 'none',
                            background: 'rgba(0,0,0,0.22)',
                            color: '#fff',
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{padding: 10, display: 'flex', gap: 8, alignItems: 'stretch'}}>
                    <BranchColumn
                        title={block.type === 'if_then' ? 'Then' : null}
                        accent={meta.color}
                        blocks={children}
                        depth={depth}
                        active={targetChildren}
                        onAdd={() => setAddTarget({parentId: block.uid, branch: 'children'})}
                    />
                    {block.type === 'if_then' ? (
                        <BranchColumn
                            title="Else"
                            accent={K.orange}
                            blocks={elseChildren}
                            depth={depth}
                            active={targetElse}
                            onAdd={() => setAddTarget({parentId: block.uid, branch: 'else'})}
                        />
                    ) : null}
                </div>
                <PortDot color={meta.color} top={false} />
            </div>
        </div>
    );
};

export default ProgramBlock;
