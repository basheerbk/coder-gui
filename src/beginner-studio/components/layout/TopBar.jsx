import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {moduleById} from '../../domain/modules';

const TopBar = () => {
    const {
        view,
        setView,
        projectName,
        setProjectName,
        selectedModule,
        connections,
        setShowProjectLibrary,
        clearSelection,
        K,
        theme,
        setTheme,
        wireHint
    } = useStudio();

    const selectedDef = selectedModule ? moduleById(selectedModule) : null;

    const tabStyle = active => ({
        border: 'none',
        background: active ? K.accent : 'transparent',
        color: active ? '#fff' : K.sub,
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
    });

    return (
        <header
            style={{
                height: 48,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 12px',
                background: K.panel,
                borderBottom: `1px solid ${K.border}`
            }}
        >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <div
                    aria-hidden="true"
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: `linear-gradient(135deg, ${K.accent}, ${K.cyan})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#fff'
                    }}
                >
                    TB
                </div>
                <span style={{fontWeight: 700, fontSize: 14, color: K.text}}>TinkerBit</span>
            </div>

            <button
                type="button"
                onClick={() => setShowProjectLibrary(true)}
                style={{
                    background: K.surface,
                    border: 'none',
                    color: K.text,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer'
                }}
            >
                Projects
            </button>

            <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                aria-label="Project name"
                style={{
                    width: 160,
                    background: K.canvas,
                    border: `1px solid ${K.border}`,
                    borderRadius: 8,
                    color: K.text,
                    padding: '6px 10px',
                    fontSize: 12
                }}
            />

            <div
                style={{
                    display: 'flex',
                    background: K.canvas,
                    borderRadius: 10,
                    padding: 3,
                    gap: 2
                }}
            >
                <button type="button" style={tabStyle(view === 'build')} onClick={() => setView('build')}>
                    Build
                </button>
                <button type="button" style={tabStyle(view === 'code')} onClick={() => setView('code')}>
                    Code
                </button>
            </div>

            <div style={{flex: 1}} />

            {selectedModule && selectedDef ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: `${selectedDef.signal === 'analog' ? K.analog : K.digital}22`,
                        border: `1px solid ${selectedDef.signal === 'analog' ? K.analog : K.digital}`,
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: K.sub
                    }}
                >
                    {selectedDef.signal === 'analog'
                        ? `Click a green Analog port for ${selectedDef.name}`
                        : `Click a blue Digital port for ${selectedDef.name}`}
                    <button
                        type="button"
                        onClick={clearSelection}
                        style={{
                            border: 'none',
                            background: K.surface,
                            color: K.text,
                            borderRadius: 999,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: 11
                        }}
                    >
                        Cancel
                    </button>
                </div>
            ) : null}

            {wireHint && !selectedModule ? (
                <div
                    role="status"
                    style={{
                        fontSize: 11,
                        color: K.text,
                        background: `${K.orange}22`,
                        border: `1px solid ${K.orange}`,
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontWeight: 600
                    }}
                >
                    {wireHint}
                </div>
            ) : null}

            <div
                style={{
                    fontSize: 11,
                    color: K.dim,
                    background: K.surface,
                    borderRadius: 999,
                    padding: '4px 10px'
                }}
            >
                {connections.length} module{connections.length === 1 ? '' : 's'}
            </div>

            <button
                type="button"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: K.surface,
                    border: `1px solid ${K.border}`,
                    color: K.text,
                    borderRadius: 8,
                    padding: 0,
                    cursor: 'pointer'
                }}
            >
                {theme === 'dark' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        <path
                            d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                        />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            d="M21 14.3A8.5 8.5 0 1110 3a7 7 0 0011 11.3z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>

            <a
                href="/choose"
                style={{fontSize: 11, color: K.dim, textDecoration: 'none'}}
            >
                Switch mode
            </a>
        </header>
    );
};

export default TopBar;
