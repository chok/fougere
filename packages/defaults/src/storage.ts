/** Storage resolution — `config.db` → a working data layer. */
import type { App } from '@fougere/core';
import { Fronds, type FrondDescriptor } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { Sources, type Constraint, type Source, type SourceView } from '@fougere/core';
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
   * The source an entity's rows live in — what decides whether a frame gets a real transaction or
   * an unwind it replays itself.
   */
  sourceOf?: (entityName: string) => string;
  /**
   * The engine a source runs on — the dual of `sourceOf`, which names it without
   * reaching it. A caller that must run DDL per engine needs the handle, not the name.
   */
  dbOf?: (source: string) => unknown;
  /** Every source that has an engine, the default one first. */
  sources?: () => string[];
  /** Whether that source hands out a transaction — the dual of running one in it. */
  transacts?: (source: string) => boolean;
  /** Whether that source refuses a constraint at the rows — the dual of an entity declaring one. */
  enforces?: (source: string, constraint: Constraint) => boolean;
  /** Run `fn` inside one transaction of that source, with a storage factory bound to it. */
  transacted?: <R>(source: string, fn: (storageFactory: (entity: any, name: string) => any) => Promise<R>) => Promise<R>;
  /**
   * Brings the schema up to date once the app is scanned — the storage's `up`, handed to
   * `migrating()`.
   */
  migrate?: (app: App) => Promise<void> | void;
  /** Close every engine this opened — the dual of opening them, declared by whoever did. */
  close?: () => Promise<void>;
  /** Raw synchronous handle, when the engine exposes one. */
}

/** Does this config ask for persistence at all? */
export function declaresStorage(dbConf: DbConfig): boolean {
  if (dbConf === false || dbConf === undefined) return false;
  return true;
}


/** The app as ONE source sees it. */
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

/** Resolve the data layer. */
export function resolveStorage(
  dbConf: DbConfig,
  sources?: SourcesConfig,
  /**
   * Where a relative `path:` is counted from — the directory of the config that named it.
   *
   * Absent, it is counted from the current directory, which is where an app in a
   * workspace parts ways with the file that configured it: measured, `apps/nuxt` ran from
   * its own directory and made a SECOND, empty database beside itself while the workspace
   * held the real one. Nothing was said; the additive migration created every table, the
   * seeds ran, and the app served an empty domain with a green boot.
   */
  root?: string,
): ResolvedStorage {
  if (!declaresStorage(dbConf)) return { storageFactory: undefined };

  const named: Record<string, Placement> = {};
  for (const [name, conf] of Object.entries(sources ?? {})) {
    named[name] = { source: built(conf, `sources.${name}`, root), entities: conf.entities };
  }
  return storageFrom({
    db: built(typeof dbConf === 'object' ? dbConf : {}, 'db', root),
    sources: named,
  });
}

/** One config entry, resolved to the adapter it names. */
function built(conf: Record<string, unknown>, field: string, root?: string): Source {
  const name = (conf.source as string | undefined) ?? DEFAULT_ADAPTER;

  return Sources.open(name, anchored(conf, root) as never, `${field}.source`);
}

/**
 * A relative path, counted from the config that named it. `:memory:` names no file and an
 * absolute path already says where it is — both pass through untouched, which is what
 * keeps this from being a second reader of what a path means.
 */
function anchored(conf: Record<string, unknown>, root?: string): Record<string, unknown> {
  const path = conf.path;
  if (!root || typeof path !== 'string' || path === ':memory:' || isAbsolute(path)) return conf;

  const anchoredPath = resolve(root, path);
  // Anchoring MOVES a database that a deployment has been running against, and the driver
  // would create the new one without a word: additive migration, seeds, an empty domain
  // and a green boot. So the one case where the two disagree is named.
  const beside = resolve(process.cwd(), path);
  if (beside !== anchoredPath && existsSync(beside) && !existsSync(anchoredPath)) {
    process.emitWarning(
      `${path} resolves to ${anchoredPath} beside the config that named it, and a database `
      + `already sits at ${beside}. Fougere opens the first; move the file, or write the path you mean.`,
    );
  }

  return { ...conf, path: anchoredPath };
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

/** The same routing `resolveStorage` performs, over engines the CALLER built. */
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
    // Asked of the source that will run the work, never of the default one: a frame whose
    // members all live in a transactional source gets its transaction even when `db:` has
    // none. A source that hands out none leaves the answer `false`, and a frame reads it:
    // `boot/together.ts` compensates instead, and says which of the two it built.
    transacts: (source) => engineOf(source)?.transacted !== undefined,
    // Absent means the judge is alone with it: a source that keeps no constraint of its own
    // says nothing, the way one that hands out no transaction says nothing.
    enforces: (source, constraint) => engineOf(source)?.enforces?.includes(constraint) ?? false,
    transacted: async (source, fn) => {
      const engine = engineOf(source);
      if (!engine) throw new Error(`No source named '${source}' — declared sources are ${[DEFAULT, ...engines.keys()].join(', ')}.`);
      if (!engine.transacted) throw new Error(`Source '${source}' hands out no transaction.`);
      return engine.transacted(fn);
    },
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

/**
 * The data layer as `createApp` takes it — one gesture, not eight named by hand.
 *
 * Naming a few of its members is how `transacted` and `close` were left behind once, under
 * Nuxt only: a member added here reached no host, and nothing said so. This is the same
 * lesson one level down — a host spreads the layer instead of listing what it knows of it.
 */
export function layerOf(storage: ResolvedStorage, fallback?: ResolvedStorage['storageFactory']) {
  return {
    storageFactory: storage.storageFactory ?? fallback,
    sourceOf: storage.sourceOf,
    transacts: storage.transacts,
    enforces: storage.enforces,
    transacted: storage.transacted as never,
    migrate: storage.migrate,
    db: storage.db,
  };
}
