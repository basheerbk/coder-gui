import React from 'react';

import {paletteChipMeta} from '../../domain/blockMeta';
import {useStudio} from '../../context/StudioContext.jsx';
import {buildSensorOptions, ifParamsFor} from '../../domain/condition';
import {CONTROL_BLOCKS, moduleById} from '../../domain/modules';
import {copyTag, partName} from '../../domain/partCopies';
import {SILENT_READS} from '../../domain/sensorReads';
import EmptyState from '../shared/EmptyState.jsx';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const MiniNode = ({color, iconId, label, onClick}) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            width: '100%',
            textAlign: 'left',
            marginBottom: 7,
            border: 'none',
            borderRadius: 12,
            padding: '8px 10px',
            cursor: 'pointer',
            background: color,
            boxShadow: `0 3px 0 ${color}99`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            color: '#fff'
        }}
    >
        <div
            style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}
        >
            <ModuleIcon id={iconId} color="#fff" size={15} />
        </div>
        <span
            style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}
        >
            {label}
        </span>
    </button>
);

const tabStyle = (active, K) => ({
    flex: 1,
    border: 'none',
    borderRadius: 8,
    padding: '7px 4px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? K.accent : K.surface,
    color: active ? '#fff' : K.sub
});

const GroupTitle = ({mod, name, K}) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '6px 2px 6px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: K.dim
        }}
    >
        <ModuleIcon id={mod.id} color={K.dim} size={12} />
        {name || mod.name}
    </div>
);

const BlockPalette = () => {
    const {
        connections,
        ai,
        blockPaletteCategory,
        setBlockPaletteCategory,
        addBlock,
        addTarget,
        setAddTarget,
        setView,
        K
    } = useStudio();

    const sensorOptions = buildSensorOptions(connections);
    const groups = connections.map(conn => {
        const mod = moduleById(conn.moduleId);
        if (!mod) {
            return null;
        }
        const buttons = [];
        const tag = copyTag(conn, connections);
        // Sensors are used through an If block that reads them; no separate "read" step.
        sensorOptions.filter(opt => opt.cid === conn.id).forEach(opt => {
            const label = opt.boolean ?
                `When ${opt.label.toLowerCase()} ${opt.phrase}` :
                `If ${opt.label.toLowerCase()} is…`;
            buttons.push({
                key: `${conn.id}_if_${opt.id}`,
                meta: paletteChipMeta('if_then', {label, moduleId: mod.id}),
                onClick: () => addBlock('if_then', {params: ifParamsFor(opt)})
            });
        });
        (mod.actions || []).filter(action => SILENT_READS.indexOf(action.type) === -1).forEach(action => {
            buttons.push({
                key: `${conn.id}_${action.type}`,
                meta: paletteChipMeta(action.type, {moduleId: mod.id, tag}),
                onClick: () => addBlock(action.type, {
                    cid: conn.id,
                    params: Object.assign({}, action.params || {})
                })
            });
        });
        return buttons.length ? {key: conn.id, mod, name: partName(conn, connections), buttons} : null;
    }).filter(Boolean);
    const smart = buildSensorOptions(connections, ai).find(opt => opt.ai);
    if (smart) {
        groups.push({
            key: 'ai',
            mod: {id: 'ai', name: 'Edge AI'},
            buttons: [{
                key: 'ai_if',
                meta: Object.assign(paletteChipMeta('if_then', {label: 'If the AI thinks it is…'}), {iconId: 'ai'}),
                onClick: () => addBlock('if_then', {params: ifParamsFor(smart)})
            }]
        });
    }

    return (
        <aside
            style={{
                width: 232,
                flexShrink: 0,
                background: K.panel,
                borderRight: `1px solid ${K.border}`,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}
        >
            <div style={{display: 'flex', gap: 4, padding: '10px 10px 8px'}}>
                <button
                    type="button"
                    onClick={() => setBlockPaletteCategory('actions')}
                    style={tabStyle(blockPaletteCategory === 'actions', K)}
                >
                    {'Parts'}
                </button>
                <button
                    type="button"
                    onClick={() => setBlockPaletteCategory('control')}
                    style={tabStyle(blockPaletteCategory === 'control', K)}
                >
                    {'Control'}
                </button>
            </div>

            {addTarget ? (
                <div
                    role="status"
                    style={{
                        margin: '0 10px 8px',
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: `${K.accent}1f`,
                        border: `1px solid ${K.accent}66`,
                        color: K.text,
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <span style={{flex: 1}}>
                        {addTarget.branch === 'else' ? 'Next block goes in “otherwise”' : 'Next block goes inside'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setAddTarget(null)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: K.accent,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0
                        }}
                    >
                        {'Cancel'}
                    </button>
                </div>
            ) : null}

            <div style={{overflowY: 'auto', padding: '0 10px 12px', flex: 1}}>
                {blockPaletteCategory === 'actions' ? (
                    groups.length === 0 ? (
                        <EmptyState
                            title="Add a part first"
                            hint="Go to Build, pick a part, and click a glowing port."
                            actionLabel="Open Build"
                            onAction={() => setView('build')}
                        />
                    ) : groups.map(group => (
                        <div key={group.key} style={{marginBottom: 6}}>
                            {groups.length > 1 ? <GroupTitle mod={group.mod} name={group.name} K={K} /> : null}
                            {group.buttons.map(btn => (
                                <MiniNode
                                    key={btn.key}
                                    color={btn.meta.color}
                                    iconId={btn.meta.iconId}
                                    label={btn.meta.label}
                                    onClick={btn.onClick}
                                />
                            ))}
                        </div>
                    ))
                ) : (
                    CONTROL_BLOCKS.map(ctrl => {
                        const meta = paletteChipMeta(ctrl.type);
                        return (
                            <MiniNode
                                key={ctrl.type}
                                color={meta.color}
                                iconId={meta.iconId}
                                label={meta.label}
                                onClick={() => addBlock(ctrl.type, {params: Object.assign({}, ctrl.params || {})})}
                            />
                        );
                    })
                )}
            </div>
        </aside>
    );
};

export default BlockPalette;
