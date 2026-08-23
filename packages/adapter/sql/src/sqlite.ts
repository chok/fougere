/**
 * SQLite on a file — the convention a first run meets, and the only driver this package owns.
 *
 * It sits behind its own subpath because `better-sqlite3` is a NATIVE module and `node:fs`
 * is a builtin: a bundler cannot prune a module that imports them, so re-exporting this
 * from the index made the whole adapter unreachable from a runtime that has neither. Same
 * cut as `@fougere/transport-http/receive`, and for the same reason — share the projection,
 * never the plumbing.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { createOrmFactory } from './crud.js';
import { sqlSink, type Setup, type SetupOptions } from './setup.js';

export interface SqliteSetupOptions extends SetupOptions {
  /** Filesystem path to the database. Defaults to a project-local file. */
  path?: string;
}

export interface SqliteSetup extends Setup {
  /** The raw handle, for pragmas and synchronous exec. */
  sqlite: Database.Database;
}

export function setupSqlite(opts: SqliteSetupOptions = {}): SqliteSetup {
  const path = opts.path ?? 'fougere.db';
  // A file-backed DB needs its directory — SQLite won't create it.
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database: sqlite }) });
  return {
    db,
    sqlite,
    dialect: 'sqlite',
    ormFactory: createOrmFactory(db, opts.ormFactoryOptions, 'sqlite'),
    sink: sqlSink(db),
    transacted: (fn) => db.transaction().execute((trx) => fn(createOrmFactory(trx, opts.ormFactoryOptions, 'sqlite'))),
  };
}
