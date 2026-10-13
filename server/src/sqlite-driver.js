/**
 * Minimal adapter that lets Sequelize's SQLite dialect run on Node's built-in
 * `node:sqlite` module (Node >= 22.13) instead of the native `sqlite3` package.
 * That means no compiler toolchain, no prebuilt binary downloads and no
 * platform-specific install problems.
 *
 * It implements just the slice of the `sqlite3` API that Sequelize uses:
 * Database(path, mode, cb), run, all, serialize, close, OPEN_* constants.
 */
const { DatabaseSync } = require('node:sqlite');

const OPEN_READWRITE = 2;
const OPEN_CREATE = 4;

const toSqlite = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return v;
};

function normalize(params) {
  if (params == null) return [];
  if (Array.isArray(params)) return params.map(toSqlite);
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, toSqlite(v)]));
}

function wrapError(err) {
  // Make node:sqlite errors look like the sqlite3 package's so Sequelize
  // can translate them (e.g. UNIQUE violations -> UniqueConstraintError).
  if (err && err.errcode !== undefined) {
    const primary = err.errcode & 0xff;
    if (primary === 19) err.code = 'SQLITE_CONSTRAINT';
    else if (primary === 5) err.code = 'SQLITE_BUSY';
    else err.code = 'SQLITE_ERROR';
    if (!err.message.startsWith('SQLITE_')) err.message = `${err.code}: ${err.message}`;
  }
  return err;
}

class Database {
  constructor(filename, mode, cb) {
    if (typeof mode === 'function') {
      cb = mode;
    }
    this.filename = filename;
    try {
      this.db = new DatabaseSync(filename);
      if (cb) setImmediate(() => cb(null));
    } catch (err) {
      if (cb) setImmediate(() => cb(err));
      else throw err;
    }
  }

  serialize(fn) {
    if (fn) fn();
    return this;
  }

  _exec(method, sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = undefined;
    }
    let outcome;
    try {
      const stmt = this.db.prepare(sql);
      const bound = normalize(params);
      const args = Array.isArray(bound) ? bound : [bound];
      if (method === 'all') {
        outcome = { rows: stmt.all(...args).map((r) => ({ ...r })) };
      } else {
        const info = stmt.run(...args);
        outcome = {
          ctx: { lastID: Number(info.lastInsertRowid), changes: Number(info.changes) },
        };
      }
    } catch (err) {
      outcome = { err: wrapError(err) };
    }
    if (cb) {
      setImmediate(() => {
        if (outcome.err) cb.call({}, outcome.err);
        else cb.call(outcome.ctx || {}, null, outcome.rows);
      });
    }
    return this;
  }

  run(sql, params, cb) {
    return this._exec('run', sql, params, cb);
  }

  all(sql, params, cb) {
    return this._exec('all', sql, params, cb);
  }

  close(cb) {
    try {
      this.db.close();
    } catch {
      /* already closed */
    }
    if (cb) setImmediate(() => cb(null));
  }
}

module.exports = { Database, OPEN_READWRITE, OPEN_CREATE, verbose() { return module.exports; } };
