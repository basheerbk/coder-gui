// Replaces navigator.serial with one fake CP210x port wired to sim/bridge.py over WebSocket.
// Injected with page.addInitScript before the page runs.
(() => {
    // bridge.py listens for WebSockets one port below its HTTP port.
    const WS_URL = `ws://127.0.0.1:${Number(location.port) - 1}`;
    const control = {
        log: [],
        requests: 0,
        busy: false,
        noBoard: false,
        openGlitch: false
    };

    class FakePort {
        constructor () {
            this.readable = null;
            this.writable = null;
            this.ws = null;
        }

        getInfo () {
            return {usbVendorId: 0x10c4, usbProductId: 0xea60};
        }

        async open ({baudRate}) {
            if (this.ws) throw new DOMException('The port is already open.', 'InvalidStateError');
            if (control.busy) throw new DOMException('Failed to open serial port.', 'NetworkError');
            const ws = new WebSocket(WS_URL);
            ws.binaryType = 'arraybuffer';
            await new Promise((resolve, reject) => {
                ws.onopen = resolve;
                ws.onerror = () => reject(new DOMException('Failed to open serial port.', 'NetworkError'));
            });
            this.ws = ws;
            ws.send(JSON.stringify({t: 'baud', baud: baudRate}));
            // Drivers commonly assert DTR and RTS when a port opens. openGlitch models an
            // adapter that raises RTS before DTR, which pulses EN.
            if (control.openGlitch) {
                ws.send(JSON.stringify({t: 'signals', rts: true}));
                ws.send(JSON.stringify({t: 'signals', dtr: true}));
            } else {
                ws.send(JSON.stringify({t: 'signals', dtr: true, rts: true}));
            }
            let ctrl;
            this.readable = new ReadableStream({start (c) { ctrl = c; }});
            ws.onmessage = e => {
                try { ctrl.enqueue(new Uint8Array(e.data)); } catch (err) { /* stream closed */ }
            };
            ws.onclose = () => {
                try { ctrl.close(); } catch (err) { /* already closed */ }
                if (this.ws === ws) this.readable = null;
            };
            this.writable = new WritableStream({
                write: chunk => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
                }
            });
            control.log.push({t: 'open', baud: baudRate});
        }

        async setSignals (s) {
            if (!this.ws) throw new DOMException('The port is closed.', 'InvalidStateError');
            const m = {t: 'signals'};
            if ('dataTerminalReady' in s) m.dtr = s.dataTerminalReady;
            if ('requestToSend' in s) m.rts = s.requestToSend;
            this.ws.send(JSON.stringify(m));
            control.log.push(m);
        }

        async close () {
            if (!this.ws) throw new DOMException('The port is already closed.', 'InvalidStateError');
            if ((this.readable && this.readable.locked) || (this.writable && this.writable.locked)) {
                throw new DOMException('Cannot close a port with locked streams.', 'InvalidStateError');
            }
            const ws = this.ws;
            this.ws = null;
            this.readable = null;
            this.writable = null;
            ws.close();
            control.log.push({t: 'close'});
        }
    }

    const port = new FakePort();
    let granted = false;
    const listeners = {connect: new Set(), disconnect: new Set()};
    const serial = {
        async requestPort () {
            control.requests++;
            if (control.noBoard) throw new DOMException('No port selected by the user.', 'NotFoundError');
            granted = true;
            return port;
        },
        async getPorts () {
            return granted ? [port] : [];
        },
        addEventListener (type, fn) {
            if (listeners[type]) listeners[type].add(fn);
        },
        removeEventListener (type, fn) {
            if (listeners[type]) listeners[type].delete(fn);
        }
    };
    Object.defineProperty(Navigator.prototype, 'serial', {get: () => serial, configurable: true});
    window.__fakeSerial = control;
})();
