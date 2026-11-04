import React, {useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {hasBle, hasCloud} from '../../domain/cloud';
import {MODULES} from '../../domain/modules';
import {fitsWithCloud} from '../../domain/ports';
import ModuleIcon from '../shared/ModuleIcon.jsx';

const FILTERS = [
    {id: 'all', label: 'All', categories: null},
    {id: 'sense', label: 'Sense', title: 'Parts that feel, hear or measure things', categories: ['sensor', 'input']},
    {id: 'do', label: 'Do', title: 'Parts that light up, move or show things', categories: ['output']},
    {id: 'cloud', label: 'Cloud', title: 'Talk to your phone over WiFi', categories: ['cloud']}
];

const filterById = id => FILTERS.find(f => f.id === id) || FILTERS[0];

/** Why a part cannot be picked right now (shown instead of its description), or null. */
const unavailableReason = (mod, cloudOn, bleOn) => {
    if (cloudOn && mod.id === 'ble') {
        return 'Not available with Cloud';
    }
    if (bleOn && mod.id === 'cloud') {
        return 'Remove Bluetooth to use Cloud';
    }
    if (cloudOn && !fitsWithCloud(mod)) {
        return 'Not available with Cloud (needs A1–A4)';
    }
    return null;
};

const FilterPill = ({active, label, title, onClick, K}) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            title={title}
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

const ComponentTile = ({mod, connected, unavailable, selected, onSelect, K}) => {
    const [hover, setHover] = useState(false);
    const live = !connected && !unavailable;
    const lit = selected || (hover && live);
    const tip = unavailable || (connected ? `${mod.name} is already on the board` : mod.description);

    return (
        <button
            type="button"
            aria-pressed={selected}
            aria-label={`${mod.name}: ${tip}`}
            title={tip}
            onClick={() => {
                // Unavailable tiles still call onSelect so the board explains why.
                if (!connected) {
                    onSelect(mod.id);
                }
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                position: 'relative',
                font: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 6,
                minHeight: 82,
                padding: '10px 6px 8px',
                borderRadius: 12,
                border: `1.5px solid ${selected ? mod.color : (lit ? `${mod.color}88` : K.border)}`,
                background: selected ? `${mod.color}22` : (lit ? `${mod.color}12` : K.panel),
                cursor: connected ? 'default' : (unavailable ? 'not-allowed' : 'pointer'),
                opacity: connected || unavailable ? 0.5 : 1,
                transform: hover && live ? 'translateY(-2px)' : 'none',
                boxShadow: hover && live ? `0 6px 16px ${mod.color}33` : 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, ' +
                    'box-shadow 0.15s ease, opacity 0.15s ease'
            }}
        >
            <span
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${mod.color}${lit ? '40' : '24'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s ease'
                }}
            >
                <ModuleIcon id={mod.id} color={mod.color} size={24} title={mod.name} />
            </span>
            <span
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: K.text,
                    lineHeight: 1.25,
                    textAlign: 'center',
                    overflowWrap: 'anywhere'
                }}
            >
                {mod.name}
            </span>
            {connected ? (
                <span
                    aria-hidden
                    style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: K.green,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ✓
                </span>
            ) : null}
        </button>
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

    const used = {};
    connections.forEach(c => {
        used[c.moduleId] = true;
    });

    const cloudOn = hasCloud(connections);
    const bleOn = hasBle(connections);
    const filter = filterById(categoryFilter);
    const list = MODULES.filter(m => !filter.categories || filter.categories.indexOf(m.category) !== -1);

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
                        active={filter.id === f.id}
                        label={f.label}
                        title={f.title}
                        onClick={() => setCategoryFilter(f.id)}
                        K={K}
                    />
                ))}
            </div>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '2px 10px 12px'
                }}
            >
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8}}>
                    {list.map(mod => (
                        <ComponentTile
                            key={mod.id}
                            mod={mod}
                            connected={Boolean(used[mod.id])}
                            unavailable={used[mod.id] ? null : unavailableReason(mod, cloudOn, bleOn)}
                            selected={selectedModule === mod.id}
                            onSelect={selectModule}
                            K={K}
                        />
                    ))}
                </div>
            </div>
        </aside>
    );
};

export default ComponentShelf;
