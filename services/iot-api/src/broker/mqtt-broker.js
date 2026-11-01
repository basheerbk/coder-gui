import {EventEmitter} from 'node:events';
import os from 'node:os';

import mqtt from 'mqtt';

import {log} from '../log.js';
import {
    CONTROL_TOPIC,
    RESPONSE_TOPIC,
    createDeviceCommands,
    disableCommands,
    enableCommands,
    isBenignError,
    kickCommands,
    removeCommands,
    setPasswordCommands
} from './dynsec.js';

const SUBSCRIPTIONS = {
    'tb/+/telemetry': {qos: 0},
    'tb/+/status': {qos: 1},
    'tb/+/ack': {qos: 1},
    'tb/+/alert': {qos: 1}
};
const ADMIN_TIMEOUT_MS = 5000;
const PUBLISH_TIMEOUT_MS = 5000;

export class BrokerError extends Error {
    constructor (message, command) {
        super(message);
        this.code = 'BROKER_ERROR';
        this.command = command;
    }
}

const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new BrokerError(`${label} timed out`)), ms);
    promise.then(v => {
        clearTimeout(timer);
        resolve(v);
    }, e => {
        clearTimeout(timer);
        reject(e);
    });
});

/**
 * Two connections to Mosquitto on its localhost-only listener:
 *  - ingest (persistent session, so QoS 1 status/ack/alert queue up while we restart)
 *  - admin (dynamic-security commands only)
 * Emits 'message' (topic, payload, retained) and 'connect'.
 */
export class MqttBroker extends EventEmitter {
    constructor (config) {
        super();
        this.config = config;
        this.ingest = null;
        this.adminClient = null;
        this.pending = new Map();
        this.seq = 0;
        const host = os.hostname().replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 20);
        this.ingestClientId = `tb-ingest-${host}`;
        this.adminClientId = `tb-admin-${host}-${process.pid}`;
        this.admin = {
            createDevice: (id, token, name) => this.command(createDeviceCommands(id, token, name)),
            setPassword: (id, token) => this.command(setPasswordCommands(id, token)),
            disable: id => this.command(disableCommands(id)),
            enable: id => this.command(enableCommands(id)),
            kick: id => this.command(kickCommands(id)),
            remove: id => this.command(removeCommands(id))
        };
    }

    start () {
        const {mqtt: m} = this.config;
        this.ingest = mqtt.connect(m.url, {
            username: m.ingestUser,
            password: m.ingestPass,
            clientId: this.ingestClientId,
            clean: false,
            keepalive: 30,
            reconnectPeriod: 2000,
            connectTimeout: 10000,
            protocolVersion: 4,
            queueQoSZero: false
        });
        this.ingest.on('connect', () => {
            this.ingest.subscribe(SUBSCRIPTIONS, err => {
                if (err) {
                    log.error('broker.subscribe_failed', {err});
                    return;
                }
                log.info('broker.ingest_connected');
                this.emit('connect');
            });
        });
        this.ingest.on('message', (topic, payload, packet) => {
            this.emit('message', topic, payload, Boolean(packet && packet.retain));
        });
        this.ingest.on('close', () => log.warn('broker.ingest_closed'));
        this.ingest.on('error', err => log.error('broker.ingest_error', {err}));

        this.adminClient = mqtt.connect(m.url, {
            username: m.adminUser,
            password: m.adminPass,
            clientId: this.adminClientId,
            clean: true,
            keepalive: 30,
            reconnectPeriod: 2000,
            connectTimeout: 10000,
            protocolVersion: 4
        });
        this.adminClient.on('connect', () => {
            this.adminClient.subscribe(RESPONSE_TOPIC, {qos: 1}, err => {
                if (err) {
                    log.error('broker.admin_subscribe_failed', {err});
                } else {
                    log.info('broker.admin_connected');
                }
            });
        });
        this.adminClient.on('message', (topic, payload) => {
            if (topic === RESPONSE_TOPIC) {
                this.onAdminResponse(payload);
            }
        });
        this.adminClient.on('error', err => log.error('broker.admin_error', {err}));
    }

    isConnected () {
        return Boolean(this.ingest && this.ingest.connected);
    }

    isAdminConnected () {
        return Boolean(this.adminClient && this.adminClient.connected);
    }

    publish (topic, payload, {retain = false, qos = 1} = {}) {
        if (!this.isConnected()) {
            return Promise.reject(new BrokerError('not connected'));
        }
        const p = new Promise((resolve, reject) => {
            this.ingest.publish(topic, payload, {retain, qos}, err => (err ? reject(err) : resolve()));
        });
        return withTimeout(p, PUBLISH_TIMEOUT_MS, 'publish');
    }

    onAdminResponse (payload) {
        let body;
        try {
            body = JSON.parse(payload.toString('utf8'));
        } catch (err) {
            return;
        }
        (body.responses || []).forEach(r => {
            const entry = this.pending.get(r.correlationData);
            if (!entry) {
                return;
            }
            this.pending.delete(r.correlationData);
            clearTimeout(entry.timer);
            if (r.error && !isBenignError(r.command, r.error)) {
                entry.reject(new BrokerError(r.error, r.command));
            } else {
                entry.resolve(r);
            }
        });
    }

    /** Send commands in one request; resolves once every command succeeded (benign errors count as success). */
    command (commands) {
        if (!this.isAdminConnected()) {
            return Promise.reject(new BrokerError('admin not connected'));
        }
        const waits = [];
        const tagged = commands.map(cmd => {
            this.seq = (this.seq + 1) % 1e9;
            const correlationData = `${this.adminClientId}-${Date.now()}-${this.seq}`;
            waits.push(new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pending.delete(correlationData);
                    reject(new BrokerError('dynsec timeout', cmd.command));
                }, ADMIN_TIMEOUT_MS);
                this.pending.set(correlationData, {resolve, reject, timer});
            }));
            return Object.assign({}, cmd, {correlationData});
        });
        this.adminClient.publish(CONTROL_TOPIC, JSON.stringify({commands: tagged}), {qos: 1});
        return Promise.all(waits);
    }

    stop () {
        return Promise.all([this.ingest, this.adminClient].filter(Boolean).map(c => new Promise(resolve => {
            c.end(false, {}, () => resolve());
        })));
    }
}
