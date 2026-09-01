/**
 * Storage setup — the shape every engine answers, and no driver at all.
 *
 * Fougere has no business choosing a driver (`pg`, `mysql2`, `tedious`, `better-sqlite3`,
 * a D1 binding), so the caller builds the Kysely dialect and hands it over — no dynamic
 * import, no optional dependency. This file therefore reaches for nothing: it is what a
 * runtime with no filesystem imports. The one driver this package does own lives behind
 * `@fougere/adapter-sql/sqlite`.
 */
import { Kysely, sql, type Dialect as KyselyDialect } from 'kysely';
import type { Source, SourceView } from '@fougere/core';
import { createStorageFactory, type StorageFactoryOptions } from './crud.js';
import { logQueries } from './query.js';
import { migrate } from './diff.js';
import { toTableName } from './table.js';
import type { DialectName } from './dialect.js';
import type { SqlSink } from './ddl.js';

export interface SetupOptions {
  /** Override naming for specific entities (e.g. better-auth wants singular table names). */
  storageFactoryOptions?: StorageFactoryOptions;
  /**
   * What to call this storage when a query is reported.
   *
   * A process may open several (`sources:`), and a module-level sink sees them all — without
   * a name, two statements from two databases read as one stream. Defaults to what
   * distinguishes them anyway: the engine here, the file path for SQLite.
   */
  name?: string;
}

/**
 * A `Source` realized by SQL — and the three members that are SQL's, not the routing's.
 *
 * `dialect`, `db` and `sink` are to a source what `Kysely` is to `SqlStorage.client`: what
 * this adapter is MADE OF, reached by narrowing. Nothing that routes entities across
 * sources reads them.
 */
export interface SqlSource extends Source {
  dialect: DialectName;
  storageFactory: ReturnType<typeof createStorageFactory>;
  /** Runs raw statements — what `autoMigrate` writes through. */
  sink: SqlSink;
  /**
   * The Kysely instance, for what precedes any entity: `migrate(app, setup)` writes the
   * schema through it, and a script may need it before a container exists.
   *
   * It is not the way to reach data from inside an app — that is the injected `Storage`,
   * whose `client` gives the same handle while keeping the scope of its entity.
   */
  db: Kysely<any>;
  /**
   * Run `fn` inside one transaction of this engine, with a storage factory bound to it.
   *
   * The transaction belongs to the engine, so obtaining one is a gesture on the engine and
   * nowhere else. Nothing new is handed back: `Transaction<DB> extends Kysely<DB>` and
   * `SqlStorage` takes a `Kysely<any>`, so the SAME storage is rebuilt over the substituted
   * connection — which is why a frame needs no support in this package.
   */
  transacted<R>(fn: (storageFactory: ReturnType<typeof createStorageFactory>) => Promise<R>): Promise<R>;
}

/** The name this shape answered to before it was one realization among several. */
export type Setup = SqlSource;

/**
 * The migration of what lives in ONE sql source, carrying its own dialect.
 *
 * It was the router's gesture, which had to know how SQL migrates — and did not pass the
 * dialect, so every source was migrated as sqlite, the documented Postgres case included.
 * A source knows its own engine, so the gesture is its own.
 */
function migrating(db: Kysely<any>, dialect: DialectName, opts: SetupOptions) {
  return async (view: SourceView): Promise<void> => {
    await migrate(view as never, db, {
      dialect,
      tableName: opts.storageFactoryOptions?.tableName ?? toTableName,
    });
  };
}

/** A sink that runs statements through Kysely — works on every engine. */
export function sqlSink(db: Kysely<any>): SqlSink {
  return { execute: (statement: string) => sql.raw(statement).execute(db) };
}

/** Wrap any Kysely dialect — Postgres, MySQL, SQL Server. */
export function setupKysely(
  kyselyDialect: KyselyDialect,
  dialect: DialectName,
  opts: SetupOptions = {},
): SqlSource {
  const db = new Kysely<any>({ dialect: kyselyDialect, log: logQueries(opts.name ?? dialect) });
  return {
    db,
    dialect,
    storageFactory: createStorageFactory(db, opts.storageFactoryOptions, dialect),
    sink: sqlSink(db),
    migrate: migrating(db, dialect, opts),
    close: () => db.destroy(),
    name: opts.name ?? dialect,
    transacted: (fn) => db.transaction().execute((trx) => fn(createStorageFactory(trx, opts.storageFactoryOptions, dialect))),
  };
}
