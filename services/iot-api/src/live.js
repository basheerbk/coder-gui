import {WebSocketServer} from 'ws';

import {isAllowedOrigin} from './auth.js';
import {log} from './log.js';
import {newTicket} from './tokens.js';

const TICKET_TTL_MS = 60 * 1000;
const MAX_OUTSTANDING_TICKETS = 10;
const HEARTBEAT_MS = 25 * 1000;
const MAX_BUFFERED_BYTES = 1024 * 1024;

const reject = (socket, status, text) => {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
};

/**
 * Browser live updates. Vercel rewrites cannot carry WebSockets, so the browser first
 * gets a single-use 60 s ticket through the authenticated API, then connects directly.
 * Events are only ever sent to the owner's sockets.
 */
export class LiveHub {
    constructor (config) {
        this.config = config;
        this.tickets = new Map();
        this.socketsBySub = new Map();
        this.wss = new WebSocketServer({noServer: true, maxPayload: 1024, perMessageDeflate: false});
        this.heartbeat = null;
    }

    start () {
        this.heartbeat = setInterval(() => this.beat(), HEARTBEAT_MS);
        this.heartbeat.unref();
    }

    issueTicket (sub, now = Date.now()) {
        this.sweepTickets(now);
        let outstanding = 0;
        for (const t of this.tickets.values()) {
            if (t.sub === sub) {
                outstanding++;
            }
        }
        if (outstanding >= MAX_OUTSTANDING_TICKETS) {
            return null;
        }
        const ticket = newTicket();
        this.tickets.set(ticket, {sub, exp: now + TICKET_TTL_MS});
        return ticket;
    }

    consumeTicket (ticket, now = Date.now()) {
        const t = this.tickets.get(ticket);
        if (!t) {
            return null;
        }
        this.tickets.delete(ticket);
        return t.exp >= now ? t.sub : null;
    }

    sweepTickets (now = Date.now()) {
        for (const [k, t] of this.tickets) {
            if (t.exp < now) {
                this.tickets.delete(k);
            }
        }
    }

    socketCount (sub) {
        const set = this.socketsBySub.get(sub);
        return set ? set.size : 0;
    }

    handleUpgrade (req, socket, head) {
        let url;
        try {
            url = new URL(req.url, 'http://local');
        } catch (err) {
            reject(socket, 400, 'Bad Request');
            return;
        }
        if (url.pathname !== '/iot/v1/live') {
            reject(socket, 404, 'Not Found');
            return;
        }
        if (!isAllowedOrigin(req.headers.origin, this.config)) {
            reject(socket, 403, 'Forbidden');
            return;
        }
        const sub = this.consumeTicket(url.searchParams.get('ticket') || '');
        if (!sub) {
            reject(socket, 401, 'Unauthorized');
            return;
        }
        if (this.socketCount(sub) >= this.config.limits.liveSocketsPerUser) {
            reject(socket, 429, 'Too Many Requests');
            return;
        }
        this.wss.handleUpgrade(req, socket, head, ws => this.register(sub, ws));
    }

    register (sub, ws) {
        let set = this.socketsBySub.get(sub);
        if (!set) {
            set = new Set();
            this.socketsBySub.set(sub, set);
        }
        set.add(ws);
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('message', data => {
            if (String(data) === 'ping') {
                ws.send('{"type":"pong"}');
            }
        });
        ws.on('close', () => {
            set.delete(ws);
            if (!set.size) {
                this.socketsBySub.delete(sub);
            }
        });
        ws.on('error', () => ws.terminate());
        ws.send(JSON.stringify({type: 'hello', ts: Date.now()}));
    }

    publish (sub, event) {
        const set = this.socketsBySub.get(sub);
        if (!set || !set.size) {
            return;
        }
        const text = JSON.stringify(event);
        set.forEach(ws => {
            if (ws.readyState !== ws.OPEN) {
                return;
            }
            if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
                ws.terminate();
                return;
            }
            ws.send(text);
        });
    }

    beat () {
        this.sweepTickets();
        this.wss.clients.forEach(ws => {
            if (!ws.isAlive) {
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            ws.ping();
        });
    }

    closeAll (code = 1012, reason = 'restarting') {
        clearInterval(this.heartbeat);
        this.wss.clients.forEach(ws => {
            try {
                ws.close(code, reason);
            } catch (err) {
                ws.terminate();
            }
        });
        log.info('live.closed_all');
    }
}
