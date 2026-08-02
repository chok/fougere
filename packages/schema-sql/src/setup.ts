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
   * The way past every judge, named as such.
   *
   * A statement issued on this Kysely instance meets neither the façade nor
   * `guardStorage`: a value the entity refuses lands in the table without a word. It used
   * to sit at the top level as `db`, where it read as the ordinary way in — an agent
   * writing its own GraphQL resolver took it and lost the domain's rules on that whole
   * surface (measured 2026-08-02). Reads and writes belong on the injected `EntityOrm`;
   * `migrate(app, setup)` covers the schema. What is left is the aggregate no port
   * answers — worth reaching for, worth typing the word.
   */
  unguarded: { db: Kysely<any> };
  /** @deprecated Use `migrate(app, setup)`, or `setup.unguarded.db` where nothing else answers. */
  db: Kysely<any>;
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
  return { db, unguarded: { db }, dialect, ormFactory: createOrmFactory(db, opts.ormFactoryOptions), sink: sqlSink(db) };
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
    unguarded: { db },
    sqlite,
    dialect: 'sqlite',
    ormFactory: createOrmFactory(db, opts.ormFactoryOptions),
    sink: sqlSink(db),
  };
}
