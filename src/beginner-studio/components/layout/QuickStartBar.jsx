import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {moduleById} from '../../domain/modules';
import {quickStartTemplates} from '../../domain/templates';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const QuickStartBar = () => {
    const {connections, view, loadTemplate, K} = useStudio();
    if (view !== 'build' || connections.length > 0) {
        return null;
    }
    const items = quickStartTemplates();

    return (
        <div
            style={{
                flexShrink: 0,
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                overflowX: 'auto',
                background: K.canvas,
                borderBottom: `1px solid ${K.border}`
            }}
        >
            {items.map(tpl => (
                <button
                    key={tpl.id}
                    type="button"
                    onClick={() => loadTemplate(tpl.id)}
                    style={{
                        minWidth: 170,
                        textAlign: 'left',
                        background: K.panel,
                        border: `1px solid ${K.border}`,
                        borderRadius: 12,
                        padding: 10,
                        cursor: 'pointer',
                        color: K.text,
                        animation: 'tbSlideIn 0.3s ease'
                    }}
                >
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                        {(tpl.connections || []).slice(0, 3).map(c => {
                            const mod = moduleById(c.moduleId);
                            return (
                                <ModuleIcon
                                    key={c.id}
                                    id={c.moduleId}
                                    color={mod ? mod.color : K.accent}
                                    size={16}
                                />
                            );
                        })}
                    </div>
                    <div style={{fontSize: 12, fontWeight: 700}}>{tpl.name}</div>
                    <div style={{fontSize: 10, color: K.dim, marginTop: 2, lineHeight: 1.35}}>
                        {tpl.description}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default QuickStartBar;
