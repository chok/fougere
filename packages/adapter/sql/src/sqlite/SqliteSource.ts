import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, SqliteDialect } from 'kysely';
import type BetterSqlite from 'better-sqlite3';
import { createStorageFactory } from '../crud/SqlStorage.js';
import { logQueries } from '../query/QuerySink.js';
import { drift, driftReport } from '../drift.js';
import { createKyselySource, sqlEnforces, sqlSink, type SqlSource } from '../source/SqlSource.js';
import { DRIVERS, dialectFor, messageOf, modulesOf } from '../driver/Driver.js';
import { ENGINES } from '../fields/Engine.js';
import { desiredTables, migrate } from '../diff/Change.js';
import { toTableName } from '../table/TableDef.js';
import { Sources, type Source, type SourceConfig, type SourceView } from '@fougere/core';
import type { SqliteSourceOptions } from './SqliteSourceOptions.js';

export interface SqliteSource extends SqlSource {
  /** The raw handle, for pragmas and synchronous exec. */
  sqlite: BetterSqlite.Database;
}

export function createSqliteSource(opts: SqliteSourceOptions = {}): SqliteSource {
  const path = opts.path ?? 'fougere.db';
  // A file-backed DB needs its directory — SQLite won't create it.
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = open(path);
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
      const options = { dialect: 'sqlite' as const, tableName: opts.storageFactoryOptions?.tableName ?? toTableName };
      await migrate(view as never, db, options);
      // What the additive pass left alone and the entity no longer agrees with. Asked
      // AFTER, so a column it just created is judged against what it just wrote.
      const found = await drift(db, desiredTables(view as never, options));

      return found.length ? driftReport(found) : undefined;
    },
    close: () => db.destroy(),
    name: opts.name ?? path,
    enforces: sqlEnforces,
    transacted: (fn) => db.transaction().execute((trx) => fn(createStorageFactory(trx, opts.storageFactoryOptions, 'sqlite'))),
  };
}

function open(path: string): BetterSqlite.Database {
  const [Database] = modulesOf('sqlite') as [typeof BetterSqlite];
  try {
    return new Database(path);
  } catch (error) {
    throw new Error(unopened(error, path), { cause: error });
  }
}

function unopened(error: unknown, path: string): string {
  const code = (error as { code?: string }).code;
  const rebuild = 'Build it from its sources: cd node_modules/better-sqlite3 && npx node-gyp rebuild';
  if (code === 'MODULE_NOT_FOUND' && messageOf(error).includes('better_sqlite3.node')) {
    return `'better-sqlite3' ships no native binary for ${process.platform}-${process.arch} — its prebuilt ones cover `
      + `linux, macOS and Windows on x64 and arm64. ${rebuild}`;
  }
  if (code === 'ERR_DLOPEN_FAILED') {
    return `The native binary of 'better-sqlite3' does not load under Node ${process.version}: ${messageOf(error)}. ${rebuild}`;
  }

  return `SQLite could not open '${path}': ${messageOf(error)}`;
}

/** `source. */
Sources.register('sql', (conf: SourceConfig): Source => {
  const dialect = conf.dialect as string | undefined;
  const name = conf.name as string | undefined;
  if (dialect === undefined || dialect === 'sqlite') return createSqliteSource({ path: conf.path as string | undefined, name });

  if (!isDriven(dialect)) {
    throw new Error(`source 'sql': no dialect '${dialect}'. It answers ${ENGINES.join(', ')}.`);
  }
  const url = conf.url;
  if (typeof url !== 'string') throw new Error(`source 'sql', dialect '${dialect}': states no \`url\`.`);

  return createKyselySource(dialectFor(dialect, url), dialect, { name });
});

function isDriven(dialect: string): dialect is keyof typeof DRIVERS {
  return dialect in DRIVERS;
}
