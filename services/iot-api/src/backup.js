/**
 * Nightly backup (run by tinkerbit-iot-backup.timer):
 *   1. VACUUM INTO a consistent snapshot (safe while the service is writing),
 *   2. gzip + sha256, plus copies of IOT_BACKUP_EXTRA_FILES (Mosquitto dynsec + persistence),
 *   3. upload to IOT_BACKUP_S3_URI with the aws CLI when configured,
 *   4. keep the newest IOT_BACKUP_KEEP_LOCAL sets locally.
 * Exit code is non-zero on any failure so systemd marks the run failed.
 */
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import zlib from 'node:zlib';

import {loadConfig} from './config.js';
import {log} from './log.js';

const gzipFile = (src, dest) => {
    fs.writeFileSync(dest, zlib.gzipSync(fs.readFileSync(src), {level: 9}));
    return crypto.createHash('sha256').update(fs.readFileSync(dest))
        .digest('hex');
};

export function runBackup (config, stamp = new Date().toISOString()
    .replace(/[:.]/g, '-')) {
    const dir = path.join(config.backup.dir, stamp);
    fs.mkdirSync(dir, {recursive: true});
    const snapshot = path.join(dir, 'iot.db');
    const db = new DatabaseSync(config.dbPath, {readOnly: true});
    try {
        db.prepare('VACUUM INTO ?').run(snapshot);
    } finally {
        db.close();
    }
    const check = new DatabaseSync(snapshot, {readOnly: true});
    const integrity = check.prepare('PRAGMA integrity_check').get();
    check.close();
    if (!integrity || Object.values(integrity)[0] !== 'ok') {
        throw new Error('snapshot integrity_check failed');
    }
    const files = {};
    files['iot.db.gz'] = gzipFile(snapshot, `${snapshot}.gz`);
    fs.unlinkSync(snapshot);
    config.backup.extraFiles.forEach(src => {
        if (!fs.existsSync(src)) {
            log.warn('backup.extra_missing', {file: src});
            return;
        }
        const name = `${path.basename(src)}.gz`;
        files[name] = gzipFile(src, path.join(dir, name));
    });
    fs.writeFileSync(path.join(dir, 'SHA256SUMS'),
        Object.keys(files).map(name => `${files[name]}  ${name}`)
            .join('\n') + '\n');

    if (config.backup.s3Uri) {
        execFileSync('aws', ['s3', 'cp', '--recursive', '--only-show-errors', dir,
            `${config.backup.s3Uri.replace(/\/$/, '')}/${stamp}/`], {stdio: 'inherit'});
    }

    const sets = fs.readdirSync(config.backup.dir)
        .filter(name => fs.statSync(path.join(config.backup.dir, name)).isDirectory())
        .sort();
    sets.slice(0, Math.max(0, sets.length - config.backup.keepLocal)).forEach(name => {
        fs.rmSync(path.join(config.backup.dir, name), {recursive: true, force: true});
    });
    return {dir, files};
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('backup.js')) {
    try {
        const result = runBackup(loadConfig());
        log.info('backup.done', result);
    } catch (err) {
        log.error('backup.failed', {err});
        process.exitCode = 1;
    }
}
