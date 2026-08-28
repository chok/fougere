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
import { createOrmFactory, type OrmFactoryOptions } from './crud.js';
import { logQueries } from './query.js';
import type { DialectName } from './dialect.js';
import type { SqlSink } from './ddl.js';

export interface SetupOptions {
  /** Override naming for specific entities (e.g. better-auth wants singular table names). */
  ormFactoryOptions?: OrmFactoryOptions;
  /**
   * What to call this storage when a query is reported.
   *
   * A process may open several (`sources:`), and a module-level sink sees them all — without
   * a name, two statements from two databases read as one stream. Defaults to what
   * distinguishes them anyway: the engine here, the file path for SQLite.
   */
  name?: string;
}

export interface Setup {
  dialect: DialectName;
  ormFactory: ReturnType<typeof createOrmFactory>;
  /** Runs raw statements — what `autoMigrate` writes through. */
  sink: SqlSink;
  /**
   * The Kysely instance, for what precedes any entity: `migrate(app, setup)` writes the
   * schema through it, and a script may need it before a container exists.
   *
   * It is not the way to reach data from inside an app — that is the injected `EntityOrm`,
   * whose `client` gives the same handle while keeping the scope of its entity.
   */
  db: Kysely<any>;
  /**
   * Run `fn` inside one transaction of this engine, with an ORM factory bound to it.
   *
   * The transaction belongs to the engine, so obtaining one is a gesture on the engine and
   * nowhere else. Nothing new is handed back: `Transaction<DB> extends Kysely<DB>` and
   * `SqlEntityOrm` takes a `Kysely<any>`, so the SAME ORM is rebuilt over the substituted
   * connection — which is why a frame needs no support in this package.
   */
  transacted<R>(fn: (ormFactory: ReturnType<typeof createOrmFactory>) => Promise<R>): Promise<R>;
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
): Setup {
  const db = new Kysely<any>({ dialect: kyselyDialect, log: logQueries(opts.name ?? dialect) });
  return {
    db,
    dialect,
    ormFactory: createOrmFactory(db, opts.ormFactoryOptions, dialect),
    sink: sqlSink(db),
    transacted: (fn) => db.transaction().execute((trx) => fn(createOrmFactory(trx, opts.ormFactoryOptions, dialect))),
  };
}
