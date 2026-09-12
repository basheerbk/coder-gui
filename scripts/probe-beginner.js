const http = require('http');
const {JSDOM} = require('jsdom');

const get = url => new Promise((resolve, reject) => {
    http.get(url, res => {
        let data = '';
        res.on('data', c => {
            data += c;
        });
        res.on('end', () => resolve(data));
    }).on('error', reject);
});

(async () => {
    const vendor = await get('http://127.0.0.1:8601/site-vendor.js');
    const app = await get('http://127.0.0.1:8601/chunks/beginnerStudio.js');
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
        url: 'http://127.0.0.1:8601/beginner.html',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true
    });
    const w = dom.window;
    w.console.error = (...args) => {
        // eslint-disable-next-line no-console
        console.log('CONSOLE_ERROR', ...args);
    };
    w.addEventListener('error', event => {
        // eslint-disable-next-line no-console
        console.log('WINDOW_ERROR', event.error && event.error.stack ? event.error.stack : event.message);
    });
    const script1 = w.document.createElement('script');
    script1.textContent = vendor;
    w.document.body.appendChild(script1);
    const script2 = w.document.createElement('script');
    script2.textContent = app;
    w.document.body.appendChild(script2);
    await new Promise(r => setTimeout(r, 1500));
    const root = w.document.getElementById('root');
    // eslint-disable-next-line no-console
    console.log('ROOT_LEN', root ? root.innerHTML.length : -1);
    // eslint-disable-next-line no-console
    console.log('ROOT_SNIP', root ? root.innerHTML.slice(0, 300) : 'no-root');
})().catch(err => {
    // eslint-disable-next-line no-console
    console.log('FAIL', err);
});
