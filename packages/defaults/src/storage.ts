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
import { setupSqlite, migrate, type DialectName } from '@fougere/adapter-sql';

/** The `db` field of fougere.config.ts, read structurally. */
export type DbConfig =
  | false
  | 'sqlite'
  | { dialect?: string; path?: string }
  | undefined;

/** A named source and the entities it holds — the `sources` field, read structurally. */
export type SourcesConfig = Record<string, { dialect?: string; path?: string; entities: string[] }> | undefined;

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
 * Only sqlite is resolvable from a NAME — its driver is a dependency here. Any other
 * engine needs a Kysely dialect INSTANCE, which only the host can build because only
 * the host has its driver. So the name is refused, and the way in is named.
 *
 * `dialect` used to be declared and never read: `db: { dialect: 'postgres' }` started
 * SQLite and said nothing — a config whose central word was ignored.
 */
function refuseUnresolvable(declared: string | undefined, field: string): void {
  if (declared === undefined || declared === 'sqlite') return;
  throw new Error(
    `${field} '${declared}' cannot be resolved from its name — only 'sqlite' can, ` +
    `because it is the one driver this package depends on. For ${declared}, build the ` +
    `Kysely dialect yourself and call setupKysely(dialect, '${declared}') ` +
    `from @fougere/adapter-sql.`,
  );
}

/** The name an entity is registered under — 'Book' and 'book' name the same rows. */
const keyOf = (name: string): string => name.charAt(0).toLowerCase() + name.slice(1);

/** Every entity the app hosts, wherever its rows are — what a partition is cut from. */
function entityNames(app: App): string[] {
  return (app as { fronds: Array<{ entities: Array<{ name: string }> }> })
    .fronds.flatMap((frond) => frond.entities.map((entry) => entry.name));
}

/**
 * The app as ONE source sees it: the entities that live there, and the names of those
 * that do not.
 *
 * The second half is what lets the DDL stop lying. A batch holding every entity could
 * never tell a cross-source target from a typo, so it derived a table name and emitted
 * a foreign key against a table that may not exist. Cut per source, `elsewhere` says
 * which misses are legitimate — and a target in neither list is a mistake, out loud.
 *
 * Auth entities ride with the default source: a provider's tables are the app's own,
 * and nothing yet lets one declare where it lives.
 */
function partition(app: App, holds: (name: string) => boolean, withAuth: boolean): unknown {
  const typed = app as unknown as {
    fronds: Array<{ name: string; entities: Array<{ name: string }> }>;
    auth?: unknown;
  };
  const fronds = typed.fronds
    .map((frond) => ({ ...frond, entities: frond.entities.filter((entry) => holds(entry.name)) }))
    .filter((frond) => frond.entities.length > 0);
  return {
    fronds,
    auth: withAuth ? typed.auth : undefined,
    elsewhere: entityNames(app).filter((name) => !holds(name)),
  };
}

/**
 * Resolve the data layer. `db: false` (or absent) means a frond with no
 * persistence of its own — the caller decides what to fall back to.
 *
 * `sources` names the places that are NOT the default one. An entity it does not
 * name stays in `db`, so an app with one database declares nothing and behaves
 * exactly as before.
 */
export function resolveStorage(dbConf: DbConfig, sources?: SourcesConfig): ResolvedStorage {
  if (!declaresStorage(dbConf)) return { ormFactory: undefined };

  refuseUnresolvable(typeof dbConf === 'object' ? dbConf.dialect : (dbConf || undefined), 'db.dialect');
  const setup = setupSqlite({ path: typeof dbConf === 'object' ? dbConf.path : undefined });

  // Where each named entity lives. An entity claimed by two sources is refused naming
  // both: the rows would be read from one and written to the other, by whichever
  // registration ran last — the same silent duplicate `remotes:` refuses one level up.
  const home = new Map<string, string>();
  const engines = new Map<string, ReturnType<typeof setupSqlite>>();
  for (const [name, conf] of Object.entries(sources ?? {})) {
    refuseUnresolvable(conf.dialect, `sources.${name}.dialect`);
    engines.set(name, setupSqlite({ path: conf.path }));
    for (const entity of conf.entities) {
      const key = keyOf(entity);
      const claimed = home.get(key);
      if (claimed) {
        throw new Error(
          `sources: '${entity}' is claimed by both '${claimed}' and '${name}' — an entity lives in one place.`,
        );
      }
      home.set(key, name);
    }
  }

  const engineFor = (entityName: string) => {
    const source = home.get(keyOf(entityName));
    return (source && engines.get(source)) || setup;
  };

  return {
    db: setup.db,
    ormFactory: (entity: any, name: string) => engineFor(name).ormFactory(entity, name),
    raw: setup.sqlite,
    dialect: setup.dialect,
    // Additive migration: creates missing tables AND adds columns an entity gained.
    // One pass per source, each seeing only its own tables — which is what makes a
    // cross-source `ref()` a miss rather than a constraint against a stranger.
    afterBoot: async (app) => {
      await migrate(partition(app, (name) => !home.has(keyOf(name)), true) as never, setup.db);
      for (const [name, engine] of engines) {
        await migrate(partition(app, (e) => home.get(keyOf(e)) === name, false) as never, engine.db);
      }
    },
  };
}
