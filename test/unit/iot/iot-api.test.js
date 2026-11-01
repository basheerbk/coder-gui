import {IotApiError, errorText, iotApi, isTransient} from '../../../src/lib/iot-api';

const response = (status, body, headers = {}) => {
    const lower = {};
    Object.keys(headers).forEach(k => {
        lower[k.toLowerCase()] = headers[k];
    });
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: {get: name => (name.toLowerCase() in lower ? lower[name.toLowerCase()] : null)},
        json: () => (typeof body === 'string' ? Promise.reject(new SyntaxError('not json')) : Promise.resolve(body))
    };
};
const json = (status, body, headers = {}) =>
    response(status, body, Object.assign({'Content-Type': 'application/json; charset=utf-8'}, headers));
const html = status => response(status, '<html>error</html>', {'Content-Type': 'text/html'});

const setOnline = value => {
    Object.defineProperty(window.navigator, 'onLine', {configurable: true, get: () => value});
};

/** Each call takes the next outcome; the last one repeats. Errors reject like fetch does. */
const serve = (...outcomes) => {
    global.fetch = jest.fn(() => {
        const next = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    });
};

const failure = async promise => {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('expected the request to fail');
};

describe('iot-api request edge cases', () => {
    beforeEach(() => {
        setOnline(true);
        global.fetch = jest.fn();
    });

    test('returns the JSON body on success', async () => {
        serve(json(200, {devices: []}));
        expect(await iotApi.listDevices()).toEqual({devices: []});
    });

    test('204 resolves to null', async () => {
        serve(response(204, null));
        expect(await iotApi.deleteDevice('d1')).toBeNull();
    });

    test('offline fails fast without calling fetch', async () => {
        setOnline(false);
        const err = await failure(iotApi.config());
        expect(err).toBeInstanceOf(IotApiError);
        expect(err.code).toBe('offline');
        expect(global.fetch).not.toHaveBeenCalled();
        expect(isTransient(err)).toBe(true);
    });

    test('a dropped connection is retried once for reads', async () => {
        serve(new TypeError('Failed to fetch'), json(200, {devices: [1]}));
        expect(await iotApi.listDevices()).toEqual({devices: [1]});
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('a dropped connection is reported as network after the retry', async () => {
        serve(new TypeError('Failed to fetch'));
        const err = await failure(iotApi.listDevices());
        expect(err.code).toBe('network');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('writes are never repeated', async () => {
        serve(new TypeError('Failed to fetch'));
        const err = await failure(iotApi.createDevice('Lamp'));
        expect(err.code).toBe('network');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('an HTML 502 from the edge means the cloud is unavailable', async () => {
        serve(html(502));
        const err = await failure(iotApi.listDevices());
        expect(err.code).toBe('unavailable');
        expect(err.status).toBe(502);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(errorText(err)).toMatch(/not available right now/);
    });

    test('an HTML 404 (rewrite missing) is unavailable and not retried', async () => {
        serve(html(404));
        const err = await failure(iotApi.config());
        expect(err.code).toBe('unavailable');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('an HTML 504 is a timeout', async () => {
        serve(html(504));
        expect((await failure(iotApi.createDevice('x'))).code).toBe('timeout');
    });

    test('a 200 that is not JSON (misrouted to the site) is unavailable', async () => {
        serve(html(200));
        expect((await failure(iotApi.listDevices())).code).toBe('unavailable');
    });

    test('server JSON error codes win over the status', async () => {
        serve(json(403, {ok: false, error: 'not_in_pilot'}));
        const err = await failure(iotApi.listDevices());
        expect(err.code).toBe('not_in_pilot');
        expect(isTransient(err)).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('a 503 restarting body is kept as restarting with Retry-After', async () => {
        serve(json(503, {ok: false, error: 'restarting'}, {'Retry-After': '5'}));
        const err = await failure(iotApi.createDevice('x'));
        expect(err.code).toBe('restarting');
        expect(err.retryAfterSec).toBe(5);
    });

    test('rate limits tell the student how long to wait', async () => {
        serve(json(429, {ok: false, error: 'rate_limited'}, {'Retry-After': '7'}));
        expect(errorText(await failure(iotApi.createDevice('x')))).toMatch(/7 s/);
    });

    test('a bare 401 without a body is unauthenticated', async () => {
        serve(response(401, ''));
        expect((await failure(iotApi.config())).code).toBe('unauthenticated');
    });

    test('unknown codes still produce readable text', () => {
        expect(errorText('weird_code')).toBe('Something went wrong (weird_code).');
        expect(errorText(new Error('boom'))).toMatch(/Could not connect/);
        expect(errorText(null)).toBe('');
    });
});
