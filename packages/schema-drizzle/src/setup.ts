/**
 * Convention-driven storage setup for fougere.config.ts `db: 'sqlite'` style.
 *
 * The Nuxt module (and any custom bootstrap) calls setupSqlite() when the
 * user only declared `db: 'sqlite'` in their config — no plugin, no glue code.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { createOrmFactory, type OrmFactoryOptions } from './crud.js';

export interface SqliteSetupOptions {
  /** Filesystem path to the database. Defaults to a project-local file. */
  path?: string;
  /** Override naming for specific entities (e.g. better-auth wants singular table names). */
  ormFactoryOptions?: OrmFactoryOptions;
}

export interface SqliteSetup {
  db: BetterSQLite3Database;
  sqlite: Database.Database;
  ormFactory: ReturnType<typeof createOrmFactory>;
}

export function setupSqlite(opts: SqliteSetupOptions = {}): SqliteSetup {
  const sqlite = new Database(opts.path ?? 'fougere.db');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  const ormFactory = createOrmFactory(db, opts.ormFactoryOptions);
  return { db, sqlite, ormFactory };
}
