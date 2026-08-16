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
import { Fronds, type FrondDescriptor } from '@fougere/core';
import { registrationKeyOf } from '@fougere/core/contract';
import { setupSqlite, migrate, type DialectName, type Setup } from '@fougere/adapter-sql';

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
function partition(
  app: App,
  holds: (name: string) => boolean,
  withAuth: boolean,
  materialize: string[],
): unknown {
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
    // Lifted, because this function reads its app structurally on purpose — a caller
    // may hand it a shape that is app-LIKE, and the question is still the same one.
    elsewhere: Fronds.scanned(typed.fronds as FrondDescriptor[]).entityNames().filter((name) => !holds(name)),
    // A derivation makes no table unless a source names it — see AppLike.materialize.
    materialize,
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
  const named: Record<string, Placement> = {};
  for (const [name, conf] of Object.entries(sources ?? {})) {
    refuseUnresolvable(conf.dialect, `sources.${name}.dialect`);
    named[name] = { setup: setupSqlite({ path: conf.path }), entities: conf.entities };
  }
  return storageFrom({
    db: setupSqlite({ path: typeof dbConf === 'object' ? dbConf.path : undefined }),
    sources: named,
  });
}

/** One source: the engine that holds it, and the entities that live there. */
export interface Placement {
  setup: Setup;
  entities: string[];
}

export interface DeclaredStorage {
  /** The default source — where an entity no placement names lands. */
  db: Setup;
  /** The other places. Absent means one source, the way it always was. */
  sources?: Record<string, Placement>;
}

/**
 * The same routing `resolveStorage` performs, over engines the CALLER built.
 *
 * `resolveStorage` reads a config file, and a config file cannot hold a live Kysely
 * dialect — so it can only ever resolve sqlite, the one driver this package depends
 * on. That was fine while `db:` was alone, because the escape hatch was to abandon
 * the convention entirely and hand `configureFougere` your own factory. With several
 * sources that stopped being an escape: a user wanting Postgres for ONE of them had
 * to re-implement the routing and the per-source migration to keep the other.
 *
 * So the two jobs are separated. Resolving a NAME into an engine is sqlite-only and
 * stays there; placing entities and migrating each source is engine-agnostic and
 * lives here, where any `Setup` is welcome:
 *
 * ```ts
 * configureFougere(storageFrom({
 *   db: setupSqlite({ path: '.data/app.db' }),
 *   sources: { legacy: { setup: setupKysely(pgDialect, 'postgres'), entities: ['Book'] } },
 * }));
 * ```
 */
export function storageFrom(declared: DeclaredStorage): ResolvedStorage {
  const { db: base, sources } = declared;

  // Where each named entity lives. An entity claimed by two sources is refused naming
  // both: the rows would be read from one and written to the other, by whichever
  // registration ran last — the same silent duplicate `remotes:` refuses one level up.
  const home = new Map<string, string>();
  const engines = new Map<string, Setup>();
  /** Everything a source names — the opt-in that turns a derivation into stored rows. */
  const named: string[] = [];
  for (const [name, placement] of Object.entries(sources ?? {})) {
    engines.set(name, placement.setup);
    for (const entity of placement.entities) {
      const key = registrationKeyOf(entity);
      const claimed = home.get(key);
      if (claimed) {
        throw new Error(
          `sources: '${entity}' is claimed by both '${claimed}' and '${name}' — an entity lives in one place.`,
        );
      }
      home.set(key, name);
      named.push(entity);
    }
  }

  const engineFor = (entityName: string) => {
    const source = home.get(registrationKeyOf(entityName));
    return (source && engines.get(source)) || base;
  };

  return {
    db: base.db,
    ormFactory: (entity: any, name: string) => engineFor(name).ormFactory(entity, name),
    raw: (base as { sqlite?: { exec(sql: string): void } }).sqlite,
    dialect: base.dialect,
    // Additive migration: creates missing tables AND adds columns an entity gained.
    // One pass per source, each seeing only its own tables — which is what makes a
    // cross-source `ref()` a miss rather than a constraint against a stranger.
    afterBoot: async (app) => {
      await migrate(partition(app, (name) => !home.has(registrationKeyOf(name)), true, named) as never, base.db);
      for (const [name, engine] of engines) {
        await migrate(partition(app, (e) => home.get(registrationKeyOf(e)) === name, false, named) as never, engine.db);
      }
    },
  };
}
