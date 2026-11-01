import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

import {log} from './log.js';
import {MIGRATIONS} from './migrations.js';

/**
 * Open the SQLite database in WAL mode and bring the schema up to date.
 * @param {string} file path, or ':memory:' for tests
 * @returns {DatabaseSync}
 */
export function openDatabase (file) {
    if (file !== ':memory:') {
        fs.mkdirSync(path.dirname(path.resolve(file)), {recursive: true});
    }
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
    return db;
}

/**
 * Run fn inside BEGIN IMMEDIATE / COMMIT, rolling back on any error.
 * Nested calls join the outer transaction.
 */
const depth = new WeakMap();

export function transaction (db, fn) {
    const level = depth.get(db) || 0;
    if (level > 0) {
        depth.set(db, level + 1);
        try {
            return fn();
        } finally {
            depth.set(db, level);
        }
    }
    db.exec('BEGIN IMMEDIATE');
    depth.set(db, 1);
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        try {
            db.exec('ROLLBACK');
        } catch (rollbackErr) {
            // The original error is the useful one.
        }
        throw err;
    } finally {
        depth.set(db, 0);
    }
}

export function migrate (db) {
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
    const current = row && row.v ? row.v : 0;
    const latest = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
    if (current > latest) {
        // Rolled back to an older release: migrations are additive, so older code keeps working.
        log.warn('db.schema_ahead', {schema: current, code: latest});
    }
    MIGRATIONS.filter(m => m.version > current).forEach(m => {
        transaction(db, () => {
            db.exec(m.sql);
            db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
        });
    });
}

export function isWritable (db) {
    try {
        db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('ready_probe', String(Date.now()));
        return true;
    } catch (err) {
        return false;
    }
}
