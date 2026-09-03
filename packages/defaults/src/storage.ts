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
import { lowerFirst } from '@fougere/core/contract';
import { Sources, type Source, type SourceView } from '@fougere/core';
// Imported for its side effect: it is what makes `source: 'sql'` an answered name.
import '@fougere/adapter-sql/sqlite';

/** The `db` field of fougere.config.ts, read structurally. */
export type DbConfig =
  | false
  | 'sqlite'
  | { source?: string; dialect?: string; path?: string }
  | undefined;

/** A named source and the entities it holds — the `sources` field, read structurally. */
export type SourcesConfig = Record<string, { source?: string; dialect?: string; path?: string; entities: string[] }> | undefined;

export interface ResolvedStorage {
  /** Opaque handle handed to auth providers. */
  db?: unknown;
  storageFactory: ((entity: any, name: string) => any) | undefined;
  /**
   * The source an entity's rows live in — what decides whether a frame gets a real
   * transaction or an unwind it replays itself.
   *
   * Absent when the caller built a `ResolvedStorage` by hand: there is then one factory
   * and no routing, so every entity IS on one engine — but nothing here can reach into it
   * for a transaction, and a frame falls back to compensating. Not knowing and promising
   * atomicity are two different things.
   */
  sourceOf?: (entityName: string) => string;
  /**
   * The engine a source runs on — the dual of `sourceOf`, which names it without
   * reaching it. A caller that must run DDL per engine needs the handle, not the name.
   */
  dbOf?: (source: string) => unknown;
  /** Every source that has an engine, the default one first. */
  sources?: () => string[];
  /** Run `fn` inside one transaction of that source, with a storage factory bound to it. */
  transacted?: <R>(source: string, fn: (storageFactory: (entity: any, name: string) => any) => Promise<R>) => Promise<R>;
  /**
   * Brings the schema up to date once the app is scanned — the storage's `up`, handed to
   * `migrating()`. It was called `afterBoot`, a word that also meant the host's own
   * post-boot and was read in four places under the two senses.
   */
  migrate?: (app: App) => Promise<void> | void;
  /**
   * Close every engine this opened — the dual of opening them, declared by whoever did.
   *
   * `boot()` calls the factory that lands here, so `boot()` is what owns closing it: a
   * container disposes what IT built, and this connection was handed in. Without this
   * the pool of a discarded app stayed open, which is what turning the ring makes
   * ordinary rather than rare.
   */
  close?: () => Promise<void>;
  /** Raw synchronous handle, when the engine exposes one. */
}

/** Does this config ask for persistence at all? */
export function declaresStorage(dbConf: DbConfig): boolean {
  if (dbConf === false || dbConf === undefined) return false;
  return true;
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
function viewOf(
  app: App,
  holds: (name: string) => boolean,
  withAuth: boolean,
): SourceView {
  const typed = app as unknown as {
    fronds: { name: string; entities: { name: string }[] }[];
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
    elsewhere: Fronds.hosting(typed.fronds as FrondDescriptor[]).entityNames().filter((name) => !holds(name)),
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
  if (!declaresStorage(dbConf)) return { storageFactory: undefined };

  const named: Record<string, Placement> = {};
  for (const [name, conf] of Object.entries(sources ?? {})) {
    named[name] = { source: built(conf, `sources.${name}`), entities: conf.entities };
  }
  return storageFrom({
    db: built(typeof dbConf === 'object' ? dbConf : {}, 'db'),
    sources: named,
  });
}

/**
 * One config entry, resolved to the adapter it names.
 *
 * `source:` defaults to `'sql'` — the convention a first run meets, and the reason a config
 * saying only `db: 'sqlite'` keeps working. What the entry says BELOW that key belongs to the
 * adapter it named, which is also the only one that can refuse it: this function knows no
 * dialect and no driver.
 */
function built(conf: Record<string, unknown>, field: string): Source {
  const name = (conf.source as string | undefined) ?? DEFAULT_ADAPTER;

  return Sources.open(name, conf as never, `${field}.source`);
}

/** What a config naming no adapter means. */
const DEFAULT_ADAPTER = 'sql';

/** One source: what realizes it, and the entities that live there. */
export interface Placement {
  source: Source;
  entities: string[];
}

export interface DeclaredStorage {
  /** The default source — where an entity no placement names lands. */
  db: Source;
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
  const engines = new Map<string, Source>();
  for (const [name, placement] of Object.entries(sources ?? {})) {
    engines.set(name, placement.source);
    for (const entity of placement.entities) {
      const key = lowerFirst(entity);
      const claimed = home.get(key);
      if (claimed) {
        throw new Error(
          `sources: '${entity}' is claimed by both '${claimed}' and '${name}' — an entity lives in one place.`,
        );
      }
      home.set(key, name);
    }
  }

  // The default source answers to the name the config gave it, so a refusal naming two
  // sources names things the author can find in their own file.
  const DEFAULT = 'db';
  const sourceOf = (entityName: string) => home.get(lowerFirst(entityName)) ?? DEFAULT;
  const engineOf = (source: string) => (source === DEFAULT ? base : engines.get(source));
  const engineFor = (entityName: string) => {
    const source = home.get(lowerFirst(entityName));
    return (source && engines.get(source)) || base;
  };

  return {
    // Opaque, and narrowed by whoever needs it — auth wants a handle, the CLI wants Kysely.
    db: (base as { db?: unknown }).db,
    storageFactory: (entity: any, name: string) => engineFor(name).storageFactory(entity, name),
    sourceOf,
    dbOf: (source) => (engineOf(source) as { db?: unknown } | undefined)?.db,
    sources: () => [DEFAULT, ...engines.keys()],
    // A source that hands out no transaction leaves the key absent, and a frame reads the
    // absence: `boot/together.ts` compensates instead, and says which of the two it built.
    transacted: base.transacted ? async (source, fn) => {
      const engine = engineOf(source);
      if (!engine) throw new Error(`No source named '${source}' — declared sources are ${[DEFAULT, ...engines.keys()].join(', ')}.`);
      if (!engine.transacted) throw new Error(`Source '${source}' hands out no transaction.`);
      return engine.transacted(fn);
    } : undefined,
    // One pass per source, each seeing only its own entities and the NAMES of the others —
    // which is what makes a cross-source `ref()` a miss rather than a constraint against a
    // stranger. What a pass DOES is the source's own: it knows its engine, this does not.
    migrate: async (app) => {
      await base.migrate?.(viewOf(app, (name) => !home.has(lowerFirst(name)), true));
      for (const [name, engine] of engines) {
        await engine.migrate?.(viewOf(app, (e) => home.get(lowerFirst(e)) === name, false));
      }
    },
    // Every source, the default one last: a named source may hold what the default refers
    // to, and closing in reverse of opening is the rule everywhere else.
    close: async () => {
      for (const engine of [...engines.values()].reverse()) await engine.close?.();
      await base.close?.();
    },
  };
}
