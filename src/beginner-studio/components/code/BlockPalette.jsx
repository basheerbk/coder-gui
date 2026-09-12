import React from 'react';

import {paletteChipMeta} from '../../domain/blockMeta';
import {useStudio} from '../../context/StudioContext.jsx';
import {CONTROL_BLOCKS, moduleById} from '../../domain/modules';
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
            minHeight: 40,
            color: '#fff'
        }}
    >
        <div
            style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: 'rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}
        >
            <ModuleIcon id={iconId} color="#fff" size={13} />
        </div>
        <span
            style={{
                fontSize: 11,
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

const BlockPalette = () => {
    const {
        connections,
        blockPaletteCategory,
        setBlockPaletteCategory,
        addBlock,
        setView,
        K
    } = useStudio();

    const actionButtons = [];
    connections.forEach(conn => {
        const mod = moduleById(conn.moduleId);
        if (!mod) {
            return;
        }
        (mod.actions || []).forEach(action => {
            const meta = paletteChipMeta(action.type, {
                cid: conn.id,
                moduleId: mod.id,
                color: mod.color,
                label: `${action.label} · ${mod.name}`
            }, K);
            actionButtons.push({
                key: `${conn.id}_${action.type}`,
                meta,
                onClick: () => addBlock(action.type, {
                    cid: conn.id,
                    params: Object.assign({}, action.params || {})
                })
            });
        });
    });

    return (
        <aside
            style={{
                width: 220,
                flexShrink: 0,
                background: K.panel,
                borderRight: `1px solid ${K.border}`,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}
        >
            <div style={{padding: '10px 10px 6px', fontSize: 10, fontWeight: 700, color: K.muted, letterSpacing: 0.6}}>
                HARDWARE
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 10px 10px'}}>
                {connections.length === 0 ? (
                    <span style={{fontSize: 11, color: K.dim}}>No modules yet</span>
                ) : connections.map(conn => {
                    const mod = moduleById(conn.moduleId);
                    if (!mod) {
                        return null;
                    }
                    return (
                        <span
                            key={conn.id}
                            style={{
                                fontSize: 10,
                                background: K.surface,
                                borderRadius: 999,
                                padding: '3px 8px',
                                color: K.sub,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5
                            }}
                        >
                            <ModuleIcon id={mod.id} color={mod.color} size={12} />
                            {mod.name}
                        </span>
                    );
                })}
            </div>

            <div style={{display: 'flex', gap: 4, padding: '0 10px 8px'}}>
                {[
                    {id: 'actions', label: 'Actions'},
                    {id: 'control', label: 'Control'}
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBlockPaletteCategory(tab.id)}
                        style={{
                            flex: 1,
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 4px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: blockPaletteCategory === tab.id ? K.accent : K.surface,
                            color: blockPaletteCategory === tab.id ? '#fff' : K.sub
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{overflowY: 'auto', padding: '0 10px 12px', flex: 1}}>
                {blockPaletteCategory === 'actions' ? (
                    connections.length === 0 ? (
                        <EmptyState
                            title="Wire something first"
                            hint="Go to Build, pick a module, and click a port."
                            actionLabel="Open Build"
                            onAction={() => setView('build')}
                        />
                    ) : actionButtons.map(btn => (
                        <MiniNode
                            key={btn.key}
                            color={btn.meta.color}
                            iconId={btn.meta.iconId}
                            label={btn.meta.label}
                            onClick={btn.onClick}
                        />
                    ))
                ) : (
                    CONTROL_BLOCKS.map(ctrl => {
                        const meta = paletteChipMeta(ctrl.type, {label: ctrl.label}, K);
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
