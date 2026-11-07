// index.html driven in headless Chrome; navigator.serial is fake-serial.js -> sim/bridge.py.
const path = require('path');
const {test, expect} = require('@playwright/test');

const FAKE_SERIAL = path.join(__dirname, 'fake-serial.js');
let errors = [];

async function resetSim (request, opts = {}) {
    const res = await request.post('/__sim/reset', {data: opts});
    expect(res.ok()).toBeTruthy();
}

async function simState (request) {
    return (await request.get('/__sim/state')).json();
}

async function simFile (request, p) {
    return (await request.get(`/__sim/file?path=${encodeURIComponent(p)}`)).json();
}

async function openPage (page, {fake = true, query = ''} = {}) {
    errors = [];
    page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', e => errors.push(e.message));
    if (fake) await page.addInitScript({path: FAKE_SERIAL});
    await page.goto(`/index.html${query}`);
}

const status = page => page.locator('#status');
const consoleText = page => page.locator('#console');

async function connectReady (page) {
    await page.click('#connectBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 20000});
}

async function setProgram (page, code) {
    await page.fill('#editor', code);
}

test.afterEach(async ({request}) => {
    expect(errors, 'console errors').toEqual([]);
    const s = await simState(request);
    expect(s.files.filter(f => f.endsWith('.tmp')), 'leftover .tmp files').toEqual([]);
    expect(s.paste_violations, 'raw-paste flow-control violations').toBe(0);
});

test('probe with the library missing, install, then TB_INFO OK', async ({page, request}) => {
    await resetSim(request);
    await openPage(page);
    await page.click('#connectBtn');
    await expect(status(page)).toHaveText('Library missing', {timeout: 15000});
    await expect(page.locator('#errorHint')).toContainText('Install library');
    await page.click('#installLibBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 30000});
    await expect(consoleText(page)).toContainText('TB_INFO OK');
    await expect(page.locator('#boardInfo')).toContainText('TinkerBit Maker ESP32');
    const s = await simState(request);
    for (const f of ['/boot.py', '/main.py', '/lib/tinkerbit/__init__.py', '/lib/tinkerbit/board.py', '/lib/ssd1306.py']) {
        expect(s.files).toContain(f);
    }
    expect(s.resets, 'opening the port must not reset the board').toBe(0);
});

test('Run streams output while the program runs', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, "import time\nprint('start')\ntime.sleep(2)\nprint('end')\n");
    await page.click('#runBtn');
    await expect(consoleText(page)).toContainText('start', {timeout: 5000});
    await expect(status(page)).toHaveText('Running');
    await expect(consoleText(page)).not.toContainText('end');
    await expect(consoleText(page)).toContainText('end', {timeout: 5000});
    await expect(status(page)).toHaveText('Ready');
});

test('Upload writes main.py and it runs after the reset', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    const code = "import tinkerbit\nprint('hello from main')\n";
    await setProgram(page, code);
    await page.click('#uploadBtn');
    await expect(consoleText(page)).toContainText('hello from main', {timeout: 10000});
    await expect(consoleText(page)).toContainText('Program finished', {timeout: 10000});
    await expect(status(page)).toHaveText('Ready');
    expect((await simFile(request, '/main.py')).text).toBe(code);
});

test('Upload with base64 and chunked transfer', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await page.selectOption('#transferMode', 'chunked');
    await page.selectOption('#encoding', 'base64');
    const code = `# ${'x'.repeat(5000)}\nprint('big upload ok')\n`;
    await setProgram(page, code);
    await page.click('#uploadBtn');
    await expect(consoleText(page)).toContainText('big upload ok', {timeout: 15000});
    expect((await simFile(request, '/main.py')).text).toBe(code);
});

test('Stop breaks an infinite loop started with Run', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, 'while True:\n    pass\n');
    await page.click('#runBtn');
    await expect(status(page)).toHaveText('Running');
    await page.waitForTimeout(300);
    await page.click('#stopBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 5000});
    await expect(page.locator('#errorHint')).toHaveText('Stopped.');
});

test('Stop breaks an uploaded infinite loop', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, "import time\nwhile True:\n    print('tick')\n    time.sleep_ms(200)\n");
    await page.click('#uploadBtn');
    await expect(consoleText(page)).toContainText('tick', {timeout: 10000});
    await page.click('#stopBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 5000});
});

test('safe mode recovers a stuck main.py (Ctrl-C disabled) on connect and with Recover', async ({page, request}) => {
    const stuck = "import micropython\nmicropython.kbd_intr(-1)\nopen('/stuck', 'w').close()\nwhile True:\n    pass\n";
    await resetSim(request, {install_library: true, files: {'/main.py': stuck}});
    // Connecting while main.py is still starting lets Ctrl-C in before kbd_intr(-1).
    await expect.poll(async () => (await simState(request)).files, {timeout: 10000}).toContain('/stuck');
    await openPage(page);
    await page.click('#connectBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 20000});
    await expect(consoleText(page)).toContainText('Safe mode: main.py skipped');
    await page.click('#recoverBtn');
    await expect(consoleText(page)).toContainText('Safe mode: main.py skipped');
    await expect(status(page)).toHaveText('Ready', {timeout: 20000});
    const s = await simState(request);
    expect(s.resets).toBeGreaterThanOrEqual(2);
});

test('Stop falls back to hard reset + safe mode when Ctrl-C is ignored', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, 'import micropython, time\nmicropython.kbd_intr(-1)\nwhile True:\n    time.sleep_ms(10)\n');
    await page.click('#uploadBtn');
    await expect(status(page)).toHaveText('Running', {timeout: 10000});
    await page.waitForTimeout(800);
    await page.click('#stopBtn');
    await expect(consoleText(page)).toContainText('hard reset into safe mode', {timeout: 5000});
    await expect(status(page)).toHaveText('Ready', {timeout: 15000});
});

test('Stop turns motors and tones off after Run and after Upload', async ({page, request}) => {
    const spin = "import tinkerbit, time\nm = tinkerbit.Motors()\nm.speed('A', 200)\ntinkerbit.Buzzer('A3').tone(440)\nprint('spinning')\nwhile True:\n    time.sleep_ms(50)\n";
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, spin);
    await page.click('#runBtn');
    await expect(consoleText(page)).toContainText('spinning', {timeout: 10000});
    expect((await simState(request)).pwm_pins).toBeGreaterThan(0);
    await page.click('#stopBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 5000});
    await expect.poll(async () => (await simState(request)).pwm_pins, {timeout: 5000}).toBe(0);

    await page.click('#uploadBtn');
    await expect(status(page)).toHaveText('Running', {timeout: 10000});
    await expect.poll(async () => (await simState(request)).pwm_pins, {timeout: 10000}).toBeGreaterThan(0);
    await page.click('#stopBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 5000});
    await expect.poll(async () => (await simState(request)).pwm_pins, {timeout: 5000}).toBe(0);
    const boot = await simFile(request, '/tb_boot.json');
    expect(JSON.parse(boot.text).off).toEqual(['A3']);
});

test('jack conflict and ADC2 + WiFi show friendly text', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    await setProgram(page, "import tinkerbit\ntinkerbit.Led('D13')\ntinkerbit.Rfid('3D')\n");
    await page.click('#runBtn');
    await expect(page.locator('#errorLine')).toContainText("3D and D13 can't be used together", {timeout: 5000});
    await expect(status(page)).toHaveText('Ready');
    await setProgram(page, "import tinkerbit, network\nnetwork.WLAN(network.STA_IF).active(True)\nprint(tinkerbit.Pot('A1').read())\n");
    await page.click('#runBtn');
    await expect(page.locator('#errorLine')).toContainText('A ports are off while Cloud/WiFi is on', {timeout: 5000});
    await setProgram(page, "import tinkerbit\ntinkerbit.Led('D5')\n");
    await page.click('#runBtn');
    await expect(page.locator('#errorLine')).toContainText('D5 is only for the distance sensor', {timeout: 5000});
});

test('Live commands', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    const live = page.locator('#liveInput');
    await live.fill('1 + 2');
    await live.press('Enter');
    await expect(consoleText(page)).toContainText('>>> 1 + 2\n3', {timeout: 5000});
    await expect(live).toBeEnabled();
    await live.fill('import tinkerbit');
    await live.press('Enter');
    await expect(live).toBeEnabled({timeout: 5000});
    await live.fill("tinkerbit.Led('D13').on()");
    await live.press('Enter');
    await expect(live).toBeEnabled({timeout: 5000});
    await expect.poll(async () => (await simState(request)).jacks.D13).toBe(1);
    await live.fill("tinkerbit.Led('D13').value()");
    await live.press('Enter');
    await expect(consoleText(page)).toContainText("tinkerbit.Led('D13').value()\n1", {timeout: 5000});
    await live.fill('nope(');
    await live.press('Enter');
    await expect(page.locator('#errorLine')).toContainText('SyntaxError', {timeout: 5000});
});

test('stale .tmp files are removed on connect', async ({page, request}) => {
    await resetSim(request, {install_library: true, files: {'/main.py.tmp': 'half written', '/lib/x.py.tmp': 'half'}});
    await openPage(page);
    await connectReady(page);
    await expect(consoleText(page)).toContainText('Removed unfinished files');
});

test('HC-05 program: Upload only, 9600 monitor, Stop returns to 115200', async ({page, request}) => {
    await resetSim(request, {install_library: true});
    await openPage(page);
    await connectReady(page);
    const prog = "import tinkerbit, time\nbt = tinkerbit.HC05()\nbt.send('ready')\nwhile True:\n    l = bt.read_line()\n    if l is not None:\n        bt.send('echo:' + l)\n    time.sleep_ms(10)\n";
    await setProgram(page, prog);
    await page.click('#runBtn');
    await expect(page.locator('#errorLine')).toHaveText('HC-05 programs run with Upload only.');
    await page.click('#uploadBtn');
    await expect(status(page)).toHaveText('HC-05 at 9600', {timeout: 10000});
    await expect(consoleText(page)).toContainText('ready', {timeout: 5000});
    expect((await simState(request)).host_baud).toBe(9600);
    await page.locator('#liveInput').fill('ping');
    await page.locator('#liveInput').press('Enter');
    await expect(consoleText(page)).toContainText('echo:ping', {timeout: 5000});
    await page.click('#stopBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 15000});
    const s = await simState(request);
    expect(s.host_baud).toBe(115200);
    expect(s.uart_baud).toBe(115200);
});

test('busy port names the apps to close', async ({page, request}) => {
    await resetSim(request);
    await openPage(page);
    await page.evaluate(() => { window.__fakeSerial.busy = true; });
    await page.click('#connectBtn');
    await expect(page.locator('#errorLine')).toContainText('Arduino IDE, Thonny, PuTTY or other TinkerBit tabs');
    await expect(status(page)).toHaveText('Disconnected');
});

test('cancelled picker suggests a data cable', async ({page, request}) => {
    await resetSim(request);
    await openPage(page);
    await expect(page.locator('text=No board listed? Try a data cable')).toBeVisible();
    await page.evaluate(() => { window.__fakeSerial.noBoard = true; });
    await page.click('#connectBtn');
    await expect(page.locator('#errorHint')).toContainText('data cable');
});

test('browser without Web Serial', async ({page, request}) => {
    await resetSim(request);
    await page.addInitScript(() => { delete Navigator.prototype.serial; });
    await openPage(page, {fake: false});
    await expect(page.locator('#unsupported')).toBeVisible();
    await expect(page.locator('#unsupported')).toContainText('Use desktop Chrome or Edge');
    await expect(page.locator('#connectBtn')).toBeDisabled();
});

test('no MicroPython on the board offers firmware install', async ({page, request}) => {
    await resetSim(request, {firmware: 'none'});
    await openPage(page);
    await page.click('#connectBtn');
    await expect(status(page)).toHaveText('No MicroPython', {timeout: 20000});
    await expect(page.locator('#installFwBtn')).toBeVisible();
});

test('Stage B firmware: frozen library, safe mode into raw REPL', async ({page, request}) => {
    const stuck = 'import micropython\nmicropython.kbd_intr(-1)\nwhile True:\n    pass\n';
    await resetSim(request, {firmware: 'stage_b', files: {'/main.py': stuck}});
    await openPage(page);
    await page.click('#connectBtn');
    await expect(status(page)).toHaveText('Ready', {timeout: 20000});
    await expect(page.locator('#boardInfo')).toContainText('(tinkerbit)');
});
