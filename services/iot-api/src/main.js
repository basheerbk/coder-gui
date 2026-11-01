import {createApp} from './app.js';
import {loadConfig} from './config.js';
import {log} from './log.js';

let config;
try {
    config = loadConfig();
} catch (err) {
    log.error('config.invalid', {message: err.message});
    process.exit(78);
}
if (process.argv.includes('--check-config')) {
    log.info('config.ok', {production: config.production, broker: config.brokerMode, dbPath: config.dbPath});
    process.exit(0);
}

const app = createApp({config});
app.start();

let stopping = false;
const shutdown = signal => {
    if (stopping) {
        return;
    }
    stopping = true;
    log.info('server.shutdown', {signal});
    const force = setTimeout(() => {
        log.error('server.shutdown_timeout');
        process.exit(1);
    }, 10000);
    force.unref();
    app.stop().then(() => process.exit(0), err => {
        log.error('server.shutdown_failed', {err});
        process.exit(1);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', err => log.error('process.unhandled_rejection', {err}));
process.on('uncaughtException', err => {
    log.error('process.uncaught_exception', {err});
    shutdown('uncaughtException');
});
