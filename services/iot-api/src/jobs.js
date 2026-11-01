import {log} from './log.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RETENTION = {rawMs: 48 * HOUR, minuteMs: 30 * DAY, hourMs: 366 * DAY, auditMs: 180 * DAY, alertsPerDevice: 100};

/** Roll complete minutes into readings_1m and complete hours into readings_1h, guarded by watermarks. */
export function runRollups (repo, now) {
    const minuteEnd = Math.floor(now / MINUTE) * MINUTE;
    let minuteWm = Number(repo.getMeta('rollup_1m_until'));
    if (!minuteWm) {
        minuteWm = Math.floor((now - RETENTION.rawMs) / MINUTE) * MINUTE;
    }
    let minutes = 0;
    if (minuteEnd > minuteWm) {
        repo.tx(() => {
            minutes = repo.rollupMinutes(minuteWm, minuteEnd);
            repo.setMeta('rollup_1m_until', minuteEnd);
        });
        minuteWm = minuteEnd;
    }
    const hourEnd = Math.floor(minuteWm / HOUR) * HOUR;
    let hourWm = Number(repo.getMeta('rollup_1h_until'));
    if (!hourWm) {
        hourWm = Math.floor((now - RETENTION.minuteMs) / HOUR) * HOUR;
    }
    let hours = 0;
    if (hourEnd > hourWm) {
        repo.tx(() => {
            hours = repo.rollupHours(hourWm, hourEnd);
            repo.setMeta('rollup_1h_until', hourEnd);
        });
    }
    return {minutes, hours};
}

export function runRetention (repo, now) {
    const purged = repo.purgeReadings({
        rawBefore: now - RETENTION.rawMs,
        minuteBefore: now - RETENTION.minuteMs,
        hourBefore: now - RETENTION.hourMs
    });
    purged.alerts = repo.trimAlerts(RETENTION.alertsPerDevice);
    purged.audit = repo.purgeAudit(now - RETENTION.auditMs);
    return purged;
}

/**
 * Interval jobs. Each job is skipped while its previous run is still going, and a failure
 * is logged without stopping the schedule.
 */
export function startJobs ({repo, cloud, now = Date.now}) {
    const timers = [];
    const every = (name, ms, fn) => {
        let running = false;
        const t = setInterval(async () => {
            if (running) {
                return;
            }
            running = true;
            try {
                await fn();
            } catch (err) {
                log.error(`job.${name}.failed`, {err});
            } finally {
                running = false;
            }
        }, ms);
        t.unref();
        timers.push(t);
    };

    every('status', 30 * 1000, async () => {
        cloud.sweepStatus();
        await cloud.retryBrokerPending();
    });
    every('rollup', 5 * MINUTE, () => {
        const r = runRollups(repo, now());
        if (r.minutes || r.hours) {
            log.info('job.rollup', r);
        }
    });
    every('retention', HOUR, async () => {
        const r = runRetention(repo, now());
        await cloud.purgeDeleted();
        repo.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        log.info('job.retention', Object.assign(r, {stats: cloud.stats}));
    });

    return () => timers.forEach(t => clearInterval(t));
}
