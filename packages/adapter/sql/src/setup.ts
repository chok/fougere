/** Storage setup — the shape every engine answers, and no driver at all. */
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
  /** What to call this storage when a query is reported. */
  name?: string;
}

/** A `Source` realized by SQL — and the three members that are SQL's, not the routing's. */
export interface SqlSource extends Source {
  dialect: DialectName;
  storageFactory: ReturnType<typeof createStorageFactory>;
  /** Runs raw statements — what `autoMigrate` writes through. */
  sink: SqlSink;
  /** The Kysely instance, for what precedes any entity: */
  db: Kysely<any>;
  /** Run `fn` inside one transaction of this engine, with a storage factory bound to it. */
  transacted<R>(fn: (storageFactory: ReturnType<typeof createStorageFactory>) => Promise<R>): Promise<R>;
}

/** The name this shape answered to before it was one realization among several. */
export type Setup = SqlSource;

/** The migration of what lives in ONE sql source, carrying its own dialect. */
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
