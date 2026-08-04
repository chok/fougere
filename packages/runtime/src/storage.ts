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

  // `dialect` was declared on DbConfig and never read: `db: { dialect: 'postgres' }`
  // started SQLite and said nothing — a config whose central word is ignored. Only
  // sqlite is resolvable from a name (its driver is a dependency here); any other
  // engine needs a Kysely dialect INSTANCE, which only the host can build because
  // only the host has its driver. So the name is refused, and the way in is named.
  const declared = typeof dbConf === 'object' ? dbConf.dialect : dbConf;
  if (declared !== undefined && declared !== 'sqlite') {
    throw new Error(
      `db.dialect '${declared}' cannot be resolved from its name — only 'sqlite' can, ` +
      `because it is the one driver this package depends on. For ${declared}, build the ` +
      `Kysely dialect yourself and call setupKysely(dialect, '${declared}') ` +
      `from @fougere/schema-sql.`,
    );
  }

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
