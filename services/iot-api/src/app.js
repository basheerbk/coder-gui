import {MqttBroker} from './broker/mqtt-broker.js';
import {NullBroker} from './broker/null-broker.js';
import {Cloud} from './cloud.js';
import {openDatabase} from './db.js';
import {createHttpServer} from './http.js';
import {startJobs} from './jobs.js';
import {LiveHub} from './live.js';
import {log} from './log.js';
import {Repo} from './repo.js';

/**
 * Wire the service together. Tests pass their own db/broker; production builds both.
 */
export function createApp ({config, db, broker, now}) {
    const database = db || openDatabase(config.dbPath);
    const repo = new Repo(database);
    const mq = broker || (config.brokerMode === 'none' ? new NullBroker() : new MqttBroker(config));
    const live = new LiveHub(config);
    const cloud = new Cloud({config, repo, broker: mq, live, now});
    const server = createHttpServer({config, repo, cloud, live, broker: mq, now});

    mq.on('message', (topic, payload, retained) => {
        if (config.enabled) {
            cloud.handleMessage(topic, payload, retained);
        }
    });
    mq.on('connect', () => {
        cloud.republishAll().catch(err => log.error('controls.republish_failed', {err}));
        cloud.retryBrokerPending().catch(() => {});
    });

    let stopJobs = () => {};

    const start = () => new Promise(resolve => {
        mq.start();
        live.start();
        stopJobs = startJobs({repo, cloud, now});
        server.listen(config.port, config.host, () => {
            log.info('server.listening', {host: config.host, port: config.port, brokerMode: config.brokerMode});
            resolve(server.address());
        });
    });

    const stop = async () => {
        server.startDraining();
        stopJobs();
        live.closeAll(1012, 'restarting');
        await new Promise(resolve => server.close(() => resolve()));
        await mq.stop();
        try {
            database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch (err) {
            log.warn('db.checkpoint_failed');
        }
        database.close();
        log.info('server.stopped');
    };

    return {repo, cloud, live, server, broker: mq, db: database, start, stop};
}
