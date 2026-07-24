/**
 * Storage resolution — `config.db` → a working data layer.
 *
 * THE single place that names a storage package. Every host (the conventional
 * boot, the Nuxt fallback, the CLI's frond host) calls this instead of wiring an
 * engine itself; swapping the implementation is a change here and nowhere else.
 *
 * Before this existed, each host re-resolved `db: 'sqlite'` inline — which is
 * why an engine change looked like it touched seven files.
 */
import type { App } from '@fougere/core';
import { setupSqlite, migrate, type DialectName } from '@fougere/schema-sql';

/** The `db` field of fougere.config.ts, read structurally. */
export type DbConfig =
  | false
  | 'sqlite'
  | { dialect?: string; path?: string }
  | undefined;

export interface ResolvedStorage {
  /** Opaque handle handed to auth providers. */
  db?: unknown;
  ormFactory: ((entity: any, name: string) => any) | undefined;
  /** Brings the schema up to date once the app is scanned. */
  afterBoot?: (app: App) => Promise<void> | void;
  /** Raw synchronous handle, when the engine exposes one. */
  raw?: { exec(sql: string): void };
  dialect?: DialectName;
}

/** Does this config ask for persistence at all? */
export function declaresStorage(dbConf: DbConfig): boolean {
  if (dbConf === false || dbConf === undefined) return false;
  return true;
}

/**
 * Resolve the data layer. `db: false` (or absent) means a frond with no
 * persistence of its own — the caller decides what to fall back to.
 */
export function resolveStorage(dbConf: DbConfig): ResolvedStorage {
  if (!declaresStorage(dbConf)) return { ormFactory: undefined };

  const path = typeof dbConf === 'object' ? dbConf.path : undefined;
  const setup = setupSqlite({ path });

  return {
    db: setup.db,
    ormFactory: setup.ormFactory,
    raw: setup.sqlite,
    dialect: setup.dialect,
    // Additive migration: creates missing tables AND adds columns an entity
    // gained. Auth entities are included — `desiredTables` reads `app.auth`.
    afterBoot: (app) => migrate(app as never, setup.db).then(() => undefined),
  };
}
