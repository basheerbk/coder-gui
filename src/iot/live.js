import {iotApi} from '../lib/iot-api';

const MAX_BACKOFF_MS = 60000;
const PING_MS = 30000;

/**
 * Live updates over a WebSocket that is opened with a single-use ticket from the API.
 * States: connecting → live, or polling while the socket is down (the app then refreshes
 * over HTTP). Reconnects with jittered backoff and pauses while the tab is hidden.
 */
class LiveClient {
    constructor ({onEvent, onState, onReconnect}) {
        this.onEvent = onEvent;
        this.onState = onState;
        this.onReconnect = onReconnect;
        this.ws = null;
        this.attempts = 0;
        this.timer = null;
        this.pingTimer = null;
        this.stopped = true;
        this.state = 'idle';
        this.wasLive = false;
        this.handleVisibility = this.handleVisibility.bind(this);
        this.handleOnline = this.handleOnline.bind(this);
    }

    setState (state) {
        if (this.state !== state) {
            this.state = state;
            this.onState(state);
        }
    }

    start () {
        if (!this.stopped) {
            return;
        }
        this.stopped = false;
        document.addEventListener('visibilitychange', this.handleVisibility);
        window.addEventListener('online', this.handleOnline);
        this.connect();
    }

    stop () {
        this.stopped = true;
        document.removeEventListener('visibilitychange', this.handleVisibility);
        window.removeEventListener('online', this.handleOnline);
        clearTimeout(this.timer);
        this.closeSocket();
        this.setState('idle');
    }

    closeSocket () {
        clearInterval(this.pingTimer);
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
            try {
                ws.close();
            } catch (err) {
                // already closed
            }
        }
    }

    handleVisibility () {
        if (!document.hidden && !this.ws && !this.stopped) {
            clearTimeout(this.timer);
            this.connect();
        }
    }

    handleOnline () {
        if (!this.ws && !this.stopped) {
            clearTimeout(this.timer);
            this.attempts = 0;
            this.connect();
        }
    }

    scheduleRetry (minDelayMs = 0) {
        if (this.stopped) {
            return;
        }
        this.setState('polling');
        const base = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, this.attempts));
        const delay = Math.max(minDelayMs, base / 2 + Math.random() * base / 2);
        this.attempts = Math.min(this.attempts + 1, 10);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            if (document.hidden) {
                return;
            }
            this.connect();
        }, delay);
    }

    async connect () {
        if (this.stopped || this.ws) {
            return;
        }
        if (typeof WebSocket === 'undefined') {
            this.setState('polling');
            return;
        }
        this.setState(this.wasLive ? 'polling' : 'connecting');
        let ticket;
        try {
            ticket = await iotApi.liveTicket();
        } catch (err) {
            if (err.status === 401 || err.status === 403) {
                this.stopped = true;
                this.setState('polling');
                return;
            }
            this.scheduleRetry(err.retryAfterSec ? err.retryAfterSec * 1000 : 0);
            return;
        }
        if (this.stopped || this.ws) {
            return;
        }
        let ws;
        try {
            ws = new WebSocket(`${ticket.url}?ticket=${encodeURIComponent(ticket.ticket)}`);
        } catch (err) {
            this.scheduleRetry();
            return;
        }
        this.ws = ws;
        ws.onopen = () => {
            this.attempts = 0;
            this.setState('live');
            if (this.wasLive && this.onReconnect) {
                // Events sent while we were away are gone; reload the full picture.
                this.onReconnect();
            }
            this.wasLive = true;
            clearInterval(this.pingTimer);
            this.pingTimer = setInterval(() => {
                if (ws.readyState === 1) {
                    ws.send('ping');
                }
            }, PING_MS);
        };
        ws.onmessage = msg => {
            let event;
            try {
                event = JSON.parse(msg.data);
            } catch (err) {
                return;
            }
            if (event && typeof event.type === 'string' && event.type !== 'hello' && event.type !== 'pong') {
                this.onEvent(event);
            }
        };
        ws.onclose = e => {
            clearInterval(this.pingTimer);
            this.ws = null;
            // 1012 = server restarting: come back soon. 1008/4xxx policy closes back off longer.
            this.scheduleRetry(e && e.code === 1012 ? 2000 : 0);
        };
        ws.onerror = () => {
            // onclose follows and handles the retry.
        };
    }
}

export default LiveClient;
