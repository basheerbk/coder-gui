const DEFAULT_COMPILE_URL = '/api/compile';
const DEFAULT_HEALTH_URL = '/api/compile/health';
const COMPILE_TIMEOUT_MS = 180000;
const HEALTH_TIMEOUT_MS = 8000;

const getCompileUrl = () => {
    if (typeof process !== 'undefined' && process.env && process.env.COMPILE_API_URL) {
        return process.env.COMPILE_API_URL;
    }
    return DEFAULT_COMPILE_URL;
};

const getHealthUrl = () => {
    const compileUrl = getCompileUrl();
    if (compileUrl.endsWith('/health')) {
        return compileUrl;
    }
    return compileUrl.replace(/\/?$/, '/health');
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ?
        setTimeout(() => controller.abort(), timeoutMs) :
        null;
    try {
        const response = await fetch(url, Object.assign({}, options, controller ? {
            signal: controller.signal
        } : {}));
        return response;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error('Compile server timed out. Try a smaller sketch or try again.');
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
};

const checkCompileHealth = async () => {
    const response = await fetchWithTimeout(getHealthUrl(), {
        method: 'GET',
        headers: {Accept: 'application/json'}
    }, HEALTH_TIMEOUT_MS);
    if (!response.ok) {
        throw new Error(`Compile server unavailable (${response.status}).`);
    }
    const data = await response.json().catch(() => ({}));
    if (data.ok !== true) {
        throw new Error('Compile server health check failed.');
    }
    return true;
};

const compileSketch = async (source, fqbn) => {
    const trimmed = (source || '').trim();
    if (!trimmed) {
        throw new Error('Generated code is empty. Add blocks to your program first.');
    }
    if (!fqbn) {
        throw new Error('No board type selected.');
    }

    await checkCompileHealth();

    const response = await fetchWithTimeout(getCompileUrl(), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({source: trimmed, fqbn})
    }, COMPILE_TIMEOUT_MS);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error(data.error || `Compile failed (${response.status})`);
        err.log = data.log || '';
        throw err;
    }
    return data;
};

export {
    compileSketch,
    checkCompileHealth,
    getCompileUrl,
    getHealthUrl
};
