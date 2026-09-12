import React, {useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {MODULES} from '../../domain/modules';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const FILTERS = [
    {id: 'all', label: 'All'},
    {id: 'sensor', label: 'Sensors'},
    {id: 'input', label: 'Inputs'},
    {id: 'output', label: 'Outputs'}
];

const FilterPill = ({active, label, onClick, K}) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                border: 'none',
                borderRadius: 999,
                padding: '4px 8px',
                fontSize: 10,
                cursor: 'pointer',
                background: active ? K.accent : (hover ? K.border : K.surface),
                color: active ? '#fff' : K.sub,
                transform: hover && !active ? 'translateY(-1px)' : 'none',
                boxShadow: hover && !active ? `0 4px 10px ${K.border}` : 'none',
                transition: 'background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease'
            }}
        >
            {label}
        </button>
    );
};

const ComponentRow = ({mod, connected, selected, onSelect, K}) => {
    const [hover, setHover] = useState(false);
    const liveHover = hover && !connected;
    const bg = selected ?
        `${mod.color}22` :
        (liveHover ? `${mod.color}18` : 'transparent');
    const bar = selected || liveHover ? `inset 3px 0 0 ${mod.color}` : 'none';

    return (
        <tr
            onClick={() => {
                if (!connected) {
                    onSelect(mod.id);
                }
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                cursor: connected ? 'default' : 'pointer',
                background: bg,
                boxShadow: bar,
                opacity: connected ? 0.45 : 1,
                transform: liveHover ? 'translateX(3px)' : 'none',
                transition: 'background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease'
            }}
        >
            <td style={{padding: '7px 4px 7px 10px', verticalAlign: 'middle'}}>
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: `${mod.color}${liveHover || selected ? '44' : '22'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: liveHover ? 'scale(1.12)' : 'scale(1)',
                        transition: 'transform 0.15s ease, background 0.15s ease'
                    }}
                >
                    <ModuleIcon id={mod.id} color={mod.color} size={16} title={mod.name} />
                </div>
            </td>
            <td style={{padding: '7px 6px 7px 10px', verticalAlign: 'middle'}}>
                <div style={{fontSize: 11, fontWeight: 700, color: K.text, lineHeight: 1.2}}>
                    {mod.name}
                </div>
                <div
                    style={{
                        fontSize: 9,
                        color: liveHover ? K.sub : K.dim,
                        lineHeight: 1.3,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.15s ease'
                    }}
                >
                    {mod.description}
                </div>
            </td>
            <td style={{padding: '7px 4px', verticalAlign: 'middle'}}>
                <span
                    style={{
                        fontSize: 8,
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontWeight: 700,
                        background: mod.signal === 'analog' ? `${K.analog}33` : `${K.digital}33`,
                        color: mod.signal === 'analog' ? K.analog : K.digital
                    }}
                >
                    {mod.signal === 'analog' ? 'ANA' : 'DIG'}
                </span>
            </td>
            <td style={{padding: '7px 4px', verticalAlign: 'middle'}}>
                <span
                    style={{
                        fontSize: 8,
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontWeight: 700,
                        background: K.surface,
                        color: K.dim
                    }}
                >
                    {mod.dir === 'in' ? 'IN' : 'OUT'}
                </span>
            </td>
            <td
                style={{
                    padding: '7px 8px 7px 0',
                    verticalAlign: 'middle',
                    textAlign: 'center',
                    fontSize: 11,
                    color: connected ? K.green : K.accent,
                    fontWeight: 700
                }}
            >
                {connected ? 'On' : (liveHover ? 'Use' : '')}
            </td>
        </tr>
    );
};

const ComponentShelf = () => {
    const {
        categoryFilter,
        setCategoryFilter,
        selectedModule,
        selectModule,
        connections,
        K
    } = useStudio();

    const th = {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.4,
        color: K.muted,
        textAlign: 'left',
        padding: '6px 6px',
        borderBottom: `1px solid ${K.border}`,
        whiteSpace: 'nowrap'
    };

    const used = {};
    connections.forEach(c => {
        used[c.moduleId] = true;
    });

    const list = MODULES.filter(m => categoryFilter === 'all' || m.category === categoryFilter);

    return (
        <aside
            style={{
                width: 280,
                flexShrink: 0,
                height: '100%',
                background: K.panel,
                borderRight: `1px solid ${K.border}`,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
            }}
        >
            <div style={{padding: '12px 12px 8px', fontSize: 13, fontWeight: 700}}>Components</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 10px 10px'}}>
                {FILTERS.map(f => (
                    <FilterPill
                        key={f.id}
                        active={categoryFilter === f.id}
                        label={f.label}
                        onClick={() => setCategoryFilter(f.id)}
                        K={K}
                    />
                ))}
            </div>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'scroll',
                    overflowX: 'hidden'
                }}
            >
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        tableLayout: 'fixed'
                    }}
                >
                    <thead>
                        <tr>
                            <th style={Object.assign({}, th, {
                                width: 32,
                                paddingLeft: 10,
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: K.panel
                            })}
                            > </th>
                            <th style={Object.assign({}, th, {
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: K.panel
                            })}
                            >Name</th>
                            <th style={Object.assign({}, th, {
                                width: 40,
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: K.panel
                            })}
                            >Sig</th>
                            <th style={Object.assign({}, th, {
                                width: 36,
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: K.panel
                            })}
                            >Dir</th>
                            <th style={Object.assign({}, th, {
                                width: 36,
                                paddingRight: 8,
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: K.panel
                            })}
                            > </th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map(mod => (
                            <ComponentRow
                                key={mod.id}
                                mod={mod}
                                connected={Boolean(used[mod.id])}
                                selected={selectedModule === mod.id}
                                onSelect={selectModule}
                                K={K}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </aside>
    );
};

export default ComponentShelf;
