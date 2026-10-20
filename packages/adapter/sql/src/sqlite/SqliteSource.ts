import type { mkdirSync } from 'node:fs';
import type { dirname } from 'node:path';
import { builtin } from '../driver/Builtin.js';
import { Kysely, SqliteDialect } from 'kysely';
import type BetterSqlite from 'better-sqlite3';
import { createStorageFactory } from '../crud/SqlStorage.js';
import { logQueries } from '../query/QuerySink.js';
import { drift, driftReport } from '../drift.js';
import { sqlEnforces, sqlSink, type SqlSource } from '../source/SqlSource.js';
import { messageOf, modulesOf } from '../driver/Driver.js';
import { desiredTables, migrate, pendingOf } from '../diff/Change.js';
import { toTableName } from '../table/TableDef.js';
import type { SourceView } from '@fougere/core';
import type { SqliteSourceOptions } from './SqliteSourceOptions.js';

export interface SqliteSource extends SqlSource {
  /** The raw handle, for pragmas and synchronous exec. */
  sqlite: BetterSqlite.Database;
}

export function createSqliteSource(opts: SqliteSourceOptions = {}): SqliteSource {
  const path = opts.path ?? 'fougere.db';
  // A file-backed DB needs its directory — SQLite won't create it.
  if (path !== ':memory:') {
    const fs = builtin<{ mkdirSync: typeof mkdirSync }>('node:fs', 'sqlite');
    const paths = builtin<{ dirname: typeof dirname }>('node:path', 'sqlite');
    fs.mkdirSync(paths.dirname(path), { recursive: true });
  }
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
      await migrate(view, db, options);
      // What the additive pass left alone and the entity no longer agrees with. Asked
      // AFTER, so a column it just created is judged against what it just wrote.
      const found = await drift(db, desiredTables(view, options));

      return found.length ? driftReport(found) : undefined;
    },
    pending: (view: SourceView) =>
      pendingOf(view, db, { dialect: 'sqlite', tableName: opts.storageFactoryOptions?.tableName ?? toTableName }),
    close: () => db.destroy(),
    name: opts.name ?? path,
    enforces: sqlEnforces,
    transacted: (fn) => db.transaction().execute((trx) => fn(createStorageFactory(trx, opts.storageFactoryOptions, 'sqlite'))),
  };
}

/** The SQLite this runtime has: Bun's own when it runs under Bun, where `better-sqlite3`'s native binding does not load. */
function open(path: string): BetterSqlite.Database {
  if ((globalThis as { Bun?: unknown }).Bun) return openOnBun(path);
  const [Database] = modulesOf('sqlite') as [typeof BetterSqlite];
  try {
    return new Database(path);
  } catch (error) {
    throw new Error(unopened(error, path), { cause: error });
  }
}

interface BunStatement { columnNames: string[] }
interface BunDatabase {
  prepare(sql: string): BunStatement;
  exec(sql: string): void;
  close(): void;
}

/**
 * `bun:sqlite` in the shape Kysely's dialect and this source read. It already prepares, runs and iterates
 * the same way; what it lacks is `reader` — whether a statement answers rows — which its columns say,
 * and `pragma`, which is a statement like any other.
 */
function openOnBun(path: string): BetterSqlite.Database {
  const { Database } = builtin<{ Database: new (path: string) => BunDatabase }>('bun:sqlite', 'sqlite');
  const database = new Database(path);

  return {
    prepare: (sql: string) => {
      const statement = database.prepare(sql);

      return Object.assign(statement, { reader: statement.columnNames.length > 0 });
    },
    exec: (sql: string) => database.exec(sql),
    pragma: (statement: string) => database.exec(`pragma ${statement}`),
    close: () => database.close(),
  } as unknown as BetterSqlite.Database;
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
