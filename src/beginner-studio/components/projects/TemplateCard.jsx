import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {moduleById} from '../../domain/modules';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const TemplateCard = ({template, loaded, onLoad}) => {
    const {K} = useStudio();
    const mods = (template.connections || []).map(c => moduleById(c.moduleId)).filter(Boolean);

    return (
        <button
            type="button"
            onClick={() => onLoad(template.id)}
            style={{
                textAlign: 'left',
                background: loaded ? `${K.accent}22` : K.canvas,
                border: loaded ? `1px solid ${K.accent}` : `1px solid ${K.border}`,
                borderRadius: 12,
                padding: 12,
                cursor: 'pointer',
                color: K.text,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight: 120
            }}
        >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <div style={{display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 88}}>
                    {mods.slice(0, 6).map((mod, i) => (
                        <ModuleIcon key={`${mod.id}-${i}`} id={mod.id} color={mod.color} size={16} />
                    ))}
                </div>
                <div style={{flex: 1, fontSize: 13, fontWeight: 700}}>{template.name}</div>
                {loaded ? (
                    <span style={{fontSize: 9, fontWeight: 800, color: K.accent}}>LOADED</span>
                ) : null}
            </div>
            <div style={{fontSize: 11, color: K.dim, lineHeight: 1.4}}>{template.description}</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', flexWrap: 'wrap'}}>
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: template.difficulty === 'Beginner'
                            ? `${K.green}33`
                            : (template.difficulty === 'Advanced' ? `${K.red}33` : `${K.orange}33`),
                        color: template.difficulty === 'Beginner'
                            ? K.green
                            : (template.difficulty === 'Advanced' ? K.red : K.orange)
                    }}
                >
                    {template.difficulty}
                </span>
                <span style={{fontSize: 10, color: K.dim}}>
                    {mods.length} modules · {mods.map(m => m.name).join(', ')}
                </span>
            </div>
        </button>
    );
};

export default TemplateCard;
