import React, {useMemo, useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {TEMPLATES} from '../../domain/templates';
import Modal from '../shared/Modal.jsx';

import TemplateCard from './TemplateCard.jsx';

const FILTERS = [
    {id: 'all', label: 'All'},
    {id: 'Beginner', label: 'Beginner'},
    {id: 'Medium', label: 'Medium'},
    {id: 'Advanced', label: 'Advanced'}
];

const ProjectLibraryModal = () => {
    const {showProjectLibrary, setShowProjectLibrary, loadTemplate, activeTemplateId, K} = useStudio();
    const [filter, setFilter] = useState('all');

    const filtered = useMemo(() => {
        const list = filter === 'all'
            ? TEMPLATES.slice()
            : TEMPLATES.filter(t => t.difficulty === filter);
        const rank = {Beginner: 0, Medium: 1, Advanced: 2};
        return list.sort((a, b) => {
            const da = rank[a.difficulty] != null ? rank[a.difficulty] : 9;
            const db = rank[b.difficulty] != null ? rank[b.difficulty] : 9;
            if (da !== db) {
                return da - db;
            }
            return a.name.localeCompare(b.name);
        });
    }, [filter]);

    if (!showProjectLibrary) {
        return null;
    }

    const chipColor = id => {
        if (id === 'Beginner') {
            return K.green;
        }
        if (id === 'Advanced') {
            return K.red;
        }
        if (id === 'Medium') {
            return K.orange;
        }
        return K.accent;
    };

    return (
        <Modal
            title={`Project Library · ${filtered.length}`}
            onClose={() => setShowProjectLibrary(false)}
            width={860}
        >
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 14,
                    alignItems: 'center'
                }}
            >
                <span style={{fontSize: 11, fontWeight: 700, color: K.muted, marginRight: 4}}>
                    Show
                </span>
                {FILTERS.map(f => {
                    const active = filter === f.id;
                    const color = chipColor(f.id);
                    const count = f.id === 'all'
                        ? TEMPLATES.length
                        : TEMPLATES.filter(t => t.difficulty === f.id).length;
                    return (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            style={{
                                border: active ? `1.5px solid ${color}` : `1px solid ${K.border}`,
                                background: active ? `${color}22` : K.surface,
                                color: active ? color : K.sub,
                                borderRadius: 999,
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            {f.label}
                            <span style={{opacity: 0.7, fontWeight: 700}}> · {count}</span>
                        </button>
                    );
                })}
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12
                }}
            >
                {filtered.map(tpl => (
                    <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        loaded={activeTemplateId === tpl.id}
                        onLoad={loadTemplate}
                    />
                ))}
            </div>
            {filtered.length === 0 ? (
                <div style={{fontSize: 13, color: K.dim, textAlign: 'center', padding: 24}}>
                    No projects in this level yet.
                </div>
            ) : null}
        </Modal>
    );
};

export default ProjectLibraryModal;
