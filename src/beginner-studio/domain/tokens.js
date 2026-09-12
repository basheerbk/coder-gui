const brand = {
    accent: '#3b82f6',
    green: '#10b981',
    orange: '#f59e0b',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    red: '#ef4444',
    analog: '#10b981',
    digital: '#3b82f6',
    pcb: '#6d28d9',
    pcbL: '#7c3aed',
    pcbB: '#4c1d95'
};

const dark = Object.assign({}, brand, {
    bg: '#111827',
    canvas: '#0d1117',
    panel: '#1f2937',
    surface: '#374151',
    border: '#374151',
    text: '#f9fafb',
    sub: '#d1d5db',
    dim: '#9ca3af',
    muted: '#6b7280',
    jackWell: '#0a0a0a',
    codeBg: '#0b1220',
    codeGutter: '#0a0f18',
    canvasGlow: '#1a1430',
    gridDot: 'rgba(148, 163, 184, 0.28)',
    silkscreen: '#e9d5ff',
    controller: '#f5f3ff'
});

const light = Object.assign({}, brand, {
    bg: '#f3f4f6',
    canvas: '#e8eef5',
    panel: '#ffffff',
    surface: '#e5e7eb',
    border: '#d1d5db',
    text: '#111827',
    sub: '#374151',
    dim: '#6b7280',
    muted: '#9ca3af',
    jackWell: '#0a0a0a',
    codeBg: '#f8fafc',
    codeGutter: '#eef2f7',
    canvasGlow: '#ede9fe',
    gridDot: 'rgba(71, 85, 105, 0.22)',
    silkscreen: '#faf5ff',
    controller: '#faf5ff'
});

const THEMES = {dark, light};
const THEME_KEY = 'tb_beginner_theme';

const readStoredTheme = () => {
    try {
        const stored = window.localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
    } catch (err) {
        // ignore
    }
    return 'dark';
};

const persistTheme = mode => {
    try {
        window.localStorage.setItem(THEME_KEY, mode);
    } catch (err) {
        // ignore
    }
};

const tokensFor = mode => THEMES[mode] || dark;

const fontFamily = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const baseApp = K => ({
    fontFamily,
    background: K.bg,
    color: K.text,
    height: '100vh',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
});

const K = dark;

export {K, dark, light, THEME_KEY, readStoredTheme, persistTheme, tokensFor, fontFamily, baseApp};
