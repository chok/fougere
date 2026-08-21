/**
 * Storage setup — convention for SQLite, an escape hatch for the rest.
 *
 * SQLite is the default a first run meets, so it gets a concrete helper that
 * owns its driver. Every other engine needs a driver Fougere has no business
 * choosing (`pg`, `mysql2`, `tedious`), so the caller builds the Kysely dialect
 * and hands it over — no dynamic import, no optional dependency.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, SqliteDialect, sql, type Dialect as KyselyDialect } from 'kysely';
import Database from 'better-sqlite3';
import { createOrmFactory, type OrmFactoryOptions } from './crud.js';
import type { DialectName } from './dialect.js';
import type { SqlSink } from './ddl.js';

export interface SetupOptions {
  /** Override naming for specific entities (e.g. better-auth wants singular table names). */
  ormFactoryOptions?: OrmFactoryOptions;
}

export interface SqliteSetupOptions extends SetupOptions {
  /** Filesystem path to the database. Defaults to a project-local file. */
  path?: string;
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

export interface SqliteSetup extends Setup {
  /** The raw handle, for pragmas and synchronous exec. */
  sqlite: Database.Database;
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
  const db = new Kysely<any>({ dialect: kyselyDialect });
  return {
    db,
    dialect,
    ormFactory: createOrmFactory(db, opts.ormFactoryOptions, dialect),
    sink: sqlSink(db),
    transacted: (fn) => db.transaction().execute((trx) => fn(createOrmFactory(trx, opts.ormFactoryOptions, dialect))),
  };
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
