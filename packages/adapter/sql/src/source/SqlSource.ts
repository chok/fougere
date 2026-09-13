import { Kysely, sql, type Dialect as KyselyDialect } from 'kysely';
import type { Source, SourceView } from '@fougere/core';
import { createStorageFactory } from '../crud/SqlStorage.js';
import { logQueries } from '../query/QuerySink.js';
import { desiredTables, migrate } from '../diff.js';
import { drift, driftReport } from '../drift.js';
import { toTableName } from '../table/TableDef.js';
import type { DialectName } from '../dialect/DialectName.js';
import type { SqlSink } from '../ddl/SqlSink.js';
import type { SqlSourceOptions } from './SqlSourceOptions.js';

/** A `Source` realized by SQL — and the three members that are SQL's, not the routing's. */
export interface SqlSource extends Source {
  dialect: DialectName;
  storageFactory: ReturnType<typeof createStorageFactory>;
  /** Runs raw statements — what `autoMigrate` writes through. */
  sink: SqlSink;
  /**
   * The Kysely instance, for what precedes any entity: `migrate(app, setup)` writes the schema
   * through it, and a script may need it before a container exists.
   */
  db: Kysely<any>;
  /** Run `fn` inside one transaction of this engine, with a storage factory bound to it. */
  transacted<R>(fn: (storageFactory: ReturnType<typeof createStorageFactory>) => Promise<R>): Promise<R>;
}

/** What every SQL engine keeps at the rows, whatever the dialect: the index IS the constraint. */
export const sqlEnforces = ['unique'] as const;

/** The migration of what lives in ONE sql source, carrying its own dialect. */
function migrating(db: Kysely<any>, dialect: DialectName, opts: SqlSourceOptions) {
  return async (view: SourceView): Promise<void | string> => {
    const options = { dialect, tableName: opts.storageFactoryOptions?.tableName ?? toTableName };
    await migrate(view as never, db, options);
    const found = await drift(db, desiredTables(view as never, options));

    return found.length ? driftReport(found) : undefined;
  };
}

/** A sink that runs statements through Kysely — works on every engine. */
export function sqlSink(db: Kysely<any>): SqlSink {
  return { execute: (statement: string) => sql.raw(statement).execute(db) };
}

/** Wrap any Kysely dialect — Postgres, MySQL, SQL Server. */
export function createKyselySource(
  kyselyDialect: KyselyDialect,
  dialect: DialectName,
  opts: SqlSourceOptions = {},
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
    enforces: sqlEnforces,
    transacted: (fn) => db.transaction().execute((trx) => fn(createStorageFactory(trx, opts.storageFactoryOptions, dialect))),
  };
}
