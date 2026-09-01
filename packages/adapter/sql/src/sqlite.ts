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
import { createStorageFactory } from './crud.js';
import { logQueries } from './query.js';
import { sqlSink, type SetupOptions, type SqlSource } from './setup.js';
import { migrate } from './diff.js';
import { toTableName } from './table.js';
import { Sources, type Source, type SourceConfig, type SourceView } from '@fougere/core';

export interface SqliteSetupOptions extends SetupOptions {
  /** Filesystem path to the database. Defaults to a project-local file. */
  path?: string;
}

export interface SqliteSetup extends SqlSource {
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
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database: sqlite }), log: logQueries(opts.name ?? path) });
  return {
    db,
    sqlite,
    dialect: 'sqlite',
    storageFactory: createStorageFactory(db, opts.storageFactoryOptions, 'sqlite'),
    sink: sqlSink(db),
    migrate: async (view: SourceView) => {
      await migrate(view as never, db, { dialect: 'sqlite', tableName: opts.storageFactoryOptions?.tableName ?? toTableName });
    },
    close: () => db.destroy(),
    name: opts.name ?? path,
    transacted: (fn) => db.transaction().execute((trx) => fn(createStorageFactory(trx, opts.storageFactoryOptions, 'sqlite'))),
  };
}

/**
 * `source: 'sql'` — answered HERE and not in the driver-free index, because answering a
 * name means building a driver, and this is the one this package owns.
 *
 * The refusal is `refuseUnresolvable` moved: it lived in `@fougere/defaults`, which happened
 * to import the driver, so a second adapter had nowhere to say it exists. A dialect this
 * package cannot build from a name is refused here, where the reason is true.
 */
Sources.register('sql', (conf: SourceConfig): Source => {
  const dialect = conf.dialect as string | undefined;
  if (dialect !== undefined && dialect !== 'sqlite') {
    throw new Error(
      `source 'sql', dialect '${dialect}': cannot be built from a name — only 'sqlite' can, `
      + 'because it is the one driver this package owns. Build the Kysely dialect yourself and '
      + `call setupKysely(dialect, '${dialect}'), then hand it in as a source.`,
    );
  }

  return setupSqlite({ path: conf.path as string | undefined, name: conf.name as string | undefined });
});
