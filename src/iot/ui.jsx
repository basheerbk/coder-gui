import React, {createContext, useContext} from 'react';

import {fontFamily} from '../beginner-studio/domain/tokens';

const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);

const Card = ({children, style, ...rest}) => {
    const K = useTheme();
    return (
        <div
            {...rest}
            style={Object.assign({
                background: K.panel,
                border: `1px solid ${K.border}`,
                borderRadius: 14,
                padding: 14,
                minWidth: 0
            }, style)}
        >
            {children}
        </div>
    );
};

const Button = ({kind = 'default', disabled, style, children, ...rest}) => {
    const K = useTheme();
    const palette = {
        primary: {background: K.accent, color: '#fff', border: 'none'},
        danger: {background: K.red, color: '#fff', border: 'none'},
        ghost: {background: 'transparent', color: K.sub, border: 'none'},
        default: {background: K.surface, color: K.text, border: `1px solid ${K.border}`}
    }[kind];
    return (
        <button
            type="button"
            disabled={disabled}
            {...rest}
            style={Object.assign({
                borderRadius: 10,
                padding: '9px 14px',
                minHeight: 38,
                fontSize: 13,
                fontWeight: 700,
                fontFamily,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1
            }, palette, style)}
        >
            {children}
        </button>
    );
};

const Banner = ({tone = 'info', children, action}) => {
    const K = useTheme();
    const color = {info: K.accent, warn: K.orange, error: K.red, ok: K.green}[tone];
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                background: `${color}1f`,
                border: `1px solid ${color}`,
                color: K.text,
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 12
            }}
        >
            <div style={{flex: 1, minWidth: 180}}>{children}</div>
            {action}
        </div>
    );
};

const inputStyle = K => ({
    background: K.canvas,
    border: `1px solid ${K.border}`,
    borderRadius: 10,
    color: K.text,
    padding: '9px 10px',
    fontSize: 14,
    fontFamily,
    minHeight: 38,
    boxSizing: 'border-box',
    maxWidth: '100%'
});

const Field = ({label, children, hint}) => {
    const K = useTheme();
    return (
        <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: K.muted, fontWeight: 700}}>
            {label}
            {children}
            {hint ? <span style={{fontWeight: 400, color: K.dim}}>{hint}</span> : null}
        </label>
    );
};

const StatusDot = ({status, size = 10}) => {
    const K = useTheme();
    const color = status === 'online' ? K.green : (status === 'disabled' ? K.red : K.muted);
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                borderRadius: size,
                background: color,
                boxShadow: status === 'online' ? `0 0 0 3px ${K.green}33` : 'none',
                flexShrink: 0
            }}
        />
    );
};

const SignalBars = ({bars}) => {
    const K = useTheme();
    return (
        <svg width="18" height="14" viewBox="0 0 18 14" role="img" aria-label={`WiFi ${bars} of 4`}>
            {[0, 1, 2, 3].map(i => (
                <rect
                    key={i}
                    x={i * 4.5}
                    y={10 - (i * 3)}
                    width="3"
                    height={4 + (i * 3)}
                    rx="1"
                    fill={i < bars ? K.text : K.surface}
                />
            ))}
        </svg>
    );
};

export {Banner, Button, Card, Field, SignalBars, StatusDot, ThemeContext, inputStyle, useTheme};
