// Headless Chrome (the installed browser, no download) against sim/bridge.py.
const {defineConfig} = require('@playwright/test');

const HTTP_PORT = Number(process.env.TB_HTTP_PORT) || 8796;
const WS_PORT = HTTP_PORT - 1; // fake-serial.js connects one port below the page

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        baseURL: `http://127.0.0.1:${HTTP_PORT}`,
        channel: process.env.PW_CHANNEL || 'chrome',
        headless: true
    },
    webServer: {
        command: `python sim/bridge.py --ws-port ${WS_PORT} --http-port ${HTTP_PORT}`,
        url: `http://127.0.0.1:${HTTP_PORT}/__sim/state`,
        reuseExistingServer: false,
        timeout: 30000
    }
});
