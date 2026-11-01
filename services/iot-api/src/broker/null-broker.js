import {EventEmitter} from 'node:events';

/**
 * Local development without Mosquitto (IOT_BROKER_MODE=none): device management works,
 * nothing is published, and boards cannot connect. Refused in production by config.js.
 */
export class NullBroker extends EventEmitter {
    constructor () {
        super();
        const ok = () => Promise.resolve();
        this.admin = {createDevice: ok, setPassword: ok, disable: ok, enable: ok, kick: ok, remove: ok};
    }

    start () {}

    isConnected () {
        return false;
    }

    isAdminConnected () {
        return false;
    }

    publish () {
        return Promise.resolve();
    }

    stop () {
        return Promise.resolve();
    }
}
