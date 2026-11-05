import React, {useState} from 'react';

import {errorText} from '../../../lib/iot-api';
import {rssiBars, timeAgo} from '../../../iot/format';
import {SignalBars, StatusDot} from '../../../iot/ui.jsx';

import {PhoneLink} from './LiveStep.jsx';
import {Note, ui} from './wizardUi.jsx';

const PROJECT = 'project';

const statusText = (d, now) => {
    if (d.status === 'disabled') {
        return 'Paused';
    }
    if (d.status === 'online') {
        return 'Online';
    }
    return d.lastSeen ? `Seen ${timeAgo(d.lastSeen, now)}` : 'No program yet';
};

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const SectionLabel = ({K, children}) => (
    <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: K.dim, margin: '12px 2px 6px'}}>
        {children}
    </div>
);

const BoardRow = ({K, title, sub, status, rssi, selected, onClick, label}) => (
    <button
        type="button"
        aria-pressed={selected}
        aria-label={label}
        onClick={onClick}
        style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
            padding: '9px 10px',
            borderRadius: 10,
            border: `1px solid ${selected ? K.accent : 'transparent'}`,
            background: selected ? `${K.accent}1f` : 'transparent',
            color: K.text,
            cursor: 'pointer',
            fontFamily: 'inherit'
        }}
    >
        {status ? <StatusDot status={status} /> : (
            <span aria-hidden="true" style={{width: 10, height: 10, borderRadius: 5, border: `2px dashed ${K.dim}`, boxSizing: 'border-box', flexShrink: 0}} />
        )}
        <span style={{flex: 1, minWidth: 0}}>
            <span style={{display: 'block', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                {title}
            </span>
            <span style={{display: 'block', fontSize: 11, color: K.dim}}>{sub}</span>
        </span>
        {status === 'online' && typeof rssi === 'number' ? <SignalBars bars={rssiBars(rssi)} /> : null}
    </button>
);

/** "+ Add a board": a name, then the new board opens on the right. */
const AddBoard = ({K, devices, limit, onAdd}) => {
    const s = ui(K);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const full = limit > 0 && devices.length >= limit;

    if (full) {
        return <div style={Object.assign({}, s.small, {marginTop: 10})}>You have {limit} boards, the most you can have. Delete one to add another.</div>;
    }
    if (!open) {
        return (
            <button
                type="button"
                style={Object.assign({}, s.link, {marginTop: 10, fontSize: 13, textDecoration: 'none', fontWeight: 700})}
                onClick={() => setOpen(true)}
            >
                {devices.length ? '+ Add another board' : '+ Add a board'}
            </button>
        );
    }
    const submit = async e => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Give the board a name.');
            return;
        }
        if (devices.some(d => sameName(d.name, trimmed))) {
            setError(`You already have a board called “${trimmed}”. Pick another name.`);
            return;
        }
        setBusy(true);
        setError('');
        const problem = await onAdd(trimmed);
        setBusy(false);
        if (problem) {
            setError(problem);
            return;
        }
        setName('');
        setOpen(false);
    };
    return (
        <form onSubmit={submit} style={{marginTop: 10, display: 'grid', gap: 8}}>
            <label style={s.label} htmlFor="tb-new-board">New board name</label>
            <input
                id="tb-new-board"
                value={name}
                maxLength={40}
                autoFocus
                placeholder="Garden board"
                onChange={e => setName(e.target.value)}
                style={s.input}
            />
            <div style={{display: 'flex', gap: 8}}>
                <button
                    type="submit"
                    disabled={busy}
                    style={{
                        flex: 1,
                        border: 'none',
                        background: K.accent,
                        color: '#fff',
                        borderRadius: 9,
                        padding: '8px 12px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.6 : 1
                    }}
                >
                    {busy ? 'Adding…' : 'Add board'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        setError('');
                    }}
                    style={{border: `1px solid ${K.border}`, background: K.surface, color: K.text, borderRadius: 9, padding: '8px 12px', fontSize: 13, cursor: 'pointer'}}
                >
                    Cancel
                </button>
            </div>
            {error ? <div role="alert" style={{fontSize: 12, color: K.red}}>{error}</div> : null}
        </form>
    );
};

/**
 * Left side of the IoT page: this project's board pinned on top, the student's other boards,
 * "Add a board" and the phone QR code for the board on show.
 * mode: full | compact (0-1 boards) | rail (dots only, while the dashboard is being edited) | narrow (dropdown)
 * selected: PROJECT or the id of another board
 * project: {id, name, settingUp} where settingUp means the board is picked but WiFi is not saved yet
 */
const DeviceManager = ({K, mode, devices, devicesError, onRetry, limit, project, selected, onSelect, onAdd, phone, now}) => {
    const list = devices || [];
    const projectDevice = project.id ? list.find(d => d.id === project.id) : null;
    const others = list.filter(d => d.id !== project.id);
    const projectTitle = projectDevice ? projectDevice.name : (project.id ? project.name : 'No board yet');
    let projectSub = 'Set up a board for this project';
    if (project.settingUp) {
        projectSub = 'Being set up';
    } else if (projectDevice) {
        projectSub = statusText(projectDevice, now);
    } else if (project.id && devices) {
        projectSub = 'This board was deleted';
    } else if (project.id) {
        projectSub = 'Loading…';
    }
    const projectNote = project.id && (project.settingUp || !projectDevice) ? ` (${projectSub.toLowerCase()})` : '';
    const projectLabel = `This project: ${projectTitle}${projectNote}`;

    if (mode === 'rail') {
        const dot = (key, title, status, isSelected) => (
            <button
                key={key}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={isSelected}
                onClick={() => onSelect(key)}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${isSelected ? K.accent : K.border}`,
                    background: isSelected ? `${K.accent}1f` : K.panel,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}
            >
                <StatusDot status={status || 'never'} />
            </button>
        );
        return (
            <nav aria-label="Your boards" style={{display: 'grid', gap: 8, justifyItems: 'center', paddingTop: 4}}>
                {dot(PROJECT, projectLabel, projectDevice && projectDevice.status, selected === PROJECT)}
                <div aria-hidden="true" style={{width: 20, height: 1, background: K.border}} />
                {others.map(d => dot(d.id, d.name, d.status, selected === d.id))}
            </nav>
        );
    }

    if (mode === 'narrow') {
        return (
            <div style={{background: K.panel, border: `1px solid ${K.border}`, borderRadius: 14, padding: 12}}>
                <label style={ui(K).label} htmlFor="tb-board-pick">Board to show</label>
                <select
                    id="tb-board-pick"
                    value={selected}
                    onChange={e => onSelect(e.target.value)}
                    style={ui(K).input}
                >
                    <option value={PROJECT}>{projectLabel}</option>
                    {others.map(d => <option key={d.id} value={d.id}>{d.name} ({statusText(d, now)})</option>)}
                </select>
                {devicesError ? <Note K={K} tone="red" title={errorText({code: devicesError})} /> : null}
                <AddBoard K={K} devices={list} limit={limit} onAdd={onAdd} />
            </div>
        );
    }

    return (
        <nav
            aria-label="Your boards"
            style={{background: K.panel, border: `1px solid ${K.border}`, borderRadius: 14, padding: '6px 10px 14px'}}
        >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 2px 0'}}>
                <h2 style={{fontSize: 14, fontWeight: 800, color: K.text, margin: 0, flex: 1}}>Your boards</h2>
                {devices && limit ? <span style={{fontSize: 11, color: K.dim}}>{list.length} of {limit}</span> : null}
            </div>

            <SectionLabel K={K}>This project</SectionLabel>
            <BoardRow
                K={K}
                title={projectTitle}
                sub={projectSub}
                status={projectDevice ? projectDevice.status : null}
                rssi={projectDevice ? projectDevice.rssi : null}
                selected={selected === PROJECT}
                onClick={() => onSelect(PROJECT)}
                label={`This project: ${projectTitle}, ${projectSub}`}
            />

            {others.length ? <SectionLabel K={K}>Other boards</SectionLabel> : null}
            {others.map(d => (
                <BoardRow
                    key={d.id}
                    K={K}
                    title={d.name}
                    sub={statusText(d, now)}
                    status={d.status}
                    rssi={d.rssi}
                    selected={selected === d.id}
                    onClick={() => onSelect(d.id)}
                    label={`${d.name}, ${statusText(d, now)}`}
                />
            ))}

            {!devices && !devicesError ? <div style={Object.assign({}, ui(K).small, {margin: '8px 2px'})}>Loading your boards…</div> : null}
            {devicesError ? (
                <Note
                    K={K}
                    tone="red"
                    title={errorText({code: devicesError})}
                    actions={<button type="button" style={ui(K).link} onClick={onRetry}>Try again</button>}
                />
            ) : null}

            {devices ? <AddBoard K={K} devices={list} limit={limit} onAdd={onAdd} /> : null}

            {phone ? (
                <div style={{marginTop: 14, paddingTop: 12, borderTop: `1px solid ${K.border}`}}>
                    <div style={{fontSize: 12, fontWeight: 800, color: K.sub, marginBottom: 8}}>
                        {phone.name} on your phone
                    </div>
                    <PhoneLink K={K} id={phone.id} name={phone.name} />
                </div>
            ) : null}
        </nav>
    );
};

export {PROJECT, statusText};
export default DeviceManager;
