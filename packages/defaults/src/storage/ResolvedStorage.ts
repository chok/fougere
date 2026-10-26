import type { App } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Logger, Sources, sourceViewOf, type Constraint, type Source, type SourceConfig } from '@fougere/core';
import { createMemorySource } from '@fougere/adapter-memory';
import type { SourceEntities } from './SourceEntities.js';

export interface ResolvedStorage {
  storageFactory: ((entity: any, name: string) => any) | undefined;
  /**
   * The source an entity's rows live in — what decides whether a frame gets a real transaction or
   * an unwind it replays itself.
   */
  sourceOf?: (entityName: string) => string | undefined;
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
   * Brings the schema up to date — what `fougere migrate --apply` runs, and `migrating()` for a
   * process whose database is born with it. Answers what it could not bring, when anything.
   */
  migrate?: (app: App) => Promise<string | void>;
  /** What `migrate` would create, READ — the dual the boot checks and never writes past. */
  pending?: (app: App) => Promise<string[]>;
  /** Close every engine this opened — the dual of opening them, declared by whoever did. */
  close?: () => Promise<void>;
  /** Raw synchronous handle, when the engine exposes one. */
}

/**
 * Resolve the data layer from `sources:`. The one writable entry listing no `rows` holds the rest;
 * when no entry holds rows at all, they are kept in memory, and saying so is the whole fallback.
 */
export function resolveStorage(
  sources: Record<string, SourceConfig> | undefined,
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
  const opened = Object.fromEntries(Object.entries(sources ?? {}).map(([name, entry]) => {
    const { rows, values, ...rest } = entry as { rows?: string[]; values?: string[] } & Record<string, unknown>;
    const readOnly = typeof rest.type === 'string' ? Sources.find(rest.type)?.readOnly : undefined;

    return [name, { source: Sources.open(anchored(rest, root), `sources.${name}`), rows, values, ...(readOnly && { readOnly }) }];
  }));

  return storageFrom(opened);
}

/**
 * A relative path, counted from the config that named it. `:memory:` names no file and an
 * absolute path already says where it is — both pass through untouched, which is what
 * keeps this from being a second reader of what a path means.
 */
function anchored(entry: Record<string, unknown>, root?: string): Record<string, unknown> {
  const path = entry.path;
  if (!root || typeof path !== 'string' || path === ':memory:' || isAbsolute(path)) return entry;

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

  return { ...entry, path: anchoredPath };
}

/**
 * Where an entity no source names lives, and what it is called — the one writable entry listing no
 * rows. None, while others list rows, is no default at all: the boot then refuses every entity
 * left out, naming it, rather than keeping its rows in memory beside sources that were declared.
 */
function defaultOf(sources: Record<string, SourceEntities>): [string, Source] | undefined {
  const unlisted = Object.entries(sources).filter(([, placement]) => placement.rows === undefined && !placement.readOnly);
  if (unlisted.length > 1) {
    throw new Error(
      `sources: ${unlisted.map(([name]) => `'${name}'`).join(' and ')} list no rows, so Fougere cannot tell which one `
      + 'holds the rest. Give all but one of them a rows: list.',
    );
  }
  if (unlisted.length === 1) return [unlisted[0]![0], unlisted[0]![1].source];
  if (Object.values(sources).some((placement) => placement.rows !== undefined)) return undefined;

  new Logger('storage').warn(
    Object.keys(sources).length === 0
      ? 'No sources: rows are kept in memory and lost on exit.'
      : 'No source holds rows: they are kept in memory and lost on exit.',
  );

  return ['memory', createMemorySource()];
}

/** An entity in a source's rows and in another's values is two answers to what it is. */
function refuseRowsAndValues(sources: Record<string, SourceEntities>): void {
  const valuesIn = new Map(Object.entries(sources).flatMap(([name, placement]) => (placement.values ?? []).map((entity) => [lowerFirst(entity), name] as const)));
  for (const [name, placement] of Object.entries(sources)) {
    for (const entity of placement.rows ?? []) {
      const held = valuesIn.get(lowerFirst(entity));
      if (held) {
        throw new Error(
          `sources: '${entity}' is listed in the rows: of '${name}' and the values: of '${held}'. `
          + 'An entity is rows or one value, not both — keep it in one list.',
        );
      }
    }
  }
}

/** The same routing `resolveStorage` performs, over engines the CALLER built. */
export function storageFrom(sources: Record<string, SourceEntities>): ResolvedStorage {
  refuseRowsAndValues(sources);
  const fallback = defaultOf(sources);
  const DEFAULT = fallback?.[0];
  const base = fallback?.[1];

  // Where each named entity lives. An entity claimed by two sources is refused naming
  // both: the rows would be read from one and written to the other, by whichever
  // registration ran last — the same silent duplicate `remotes:` refuses one level up.
  const home = new Map<string, string>();
  const engines = new Map<string, Source>();
  for (const [name, placement] of Object.entries(sources)) {
    if (name === DEFAULT) continue;
    engines.set(name, placement.source);
    for (const entity of placement.rows ?? []) {
      const key = lowerFirst(entity);
      const claimed = home.get(key);
      if (claimed) {
        throw new Error(
          `sources: '${entity}' is listed in both '${claimed}' and '${name}'. Keep it in one.`,
        );
      }
      home.set(key, name);
    }
  }

  // The default source answers to the name the config gave it, so a refusal naming two
  // sources names things the author can find in their own file.
  const sourceOf = (entityName: string) => home.get(lowerFirst(entityName)) ?? DEFAULT;
  const engineOf = (source: string) => (DEFAULT !== undefined && source === DEFAULT ? base : engines.get(source));
  const engineFor = (entityName: string): Source => {
    const source = home.get(lowerFirst(entityName));
    const engine = (source && engines.get(source)) || base;
    if (!engine) throw new Error(`sources: no source holds '${entityName}'. Add it to the rows: of one.`);

    return engine;
  };
  const named = (): string[] => [...(DEFAULT ? [DEFAULT] : []), ...engines.keys()];

  return {
    storageFactory: (entity: any, name: string) => engineFor(name).storageFactory(entity, name),
    sourceOf,
    dbOf: (source) => (engineOf(source) as { db?: unknown } | undefined)?.db,
    sources: named,
    // Asked of the source that will run the work, never of the default one: a frame whose
    // members all live in a transactional source gets its transaction even when the default
    // source has none. A source that hands out none leaves the answer `false`, and a frame reads it:
    // `module/frame/together.ts` compensates instead, and says which of the two it built.
    transacts: (source) => engineOf(source)?.transacted !== undefined,
    // Absent means the judge is alone with it: a source that keeps no constraint of its own
    // says nothing, the way one that hands out no transaction says nothing.
    enforces: (source, constraint) => engineOf(source)?.enforces?.includes(constraint) ?? false,
    transacted: async (source, fn) => {
      const engine = engineOf(source);
      if (!engine) throw new Error(`No source named '${source}'. Sources: ${named().join(', ')}.`);
      if (!engine.transacted) throw new Error(`Source '${source}' has no transactions.`);

      return engine.transacted(fn);
    },
    // One pass per source, each seeing only its own entities and the NAMES of the others —
    // which is what makes a cross-source `ref()` a miss rather than a constraint against a
    // stranger. What a pass DOES is the source's own: it knows its engine, this does not.
    migrate: async (app) => {
      const said = [await base?.migrate?.(sourceViewOf(app.fronds, (name) => !home.has(lowerFirst(name))))];
      for (const [name, engine] of engines) {
        said.push(await engine.migrate?.(sourceViewOf(app.fronds, (e) => home.get(lowerFirst(e)) === name)));
      }
      const reports = said.filter((report): report is string => Boolean(report));

      return reports.length > 0 ? reports.join('\n') : undefined;
    },
    // The same partition `migrate` writes through, read — so what the boot refuses is exactly
    // what the command would create. A named source says its name; the default one needs none.
    pending: async (app) => {
      const lines = [...(await base?.pending?.(sourceViewOf(app.fronds, (name) => !home.has(lowerFirst(name)))) ?? [])];
      for (const [name, engine] of engines) {
        const behind = await engine.pending?.(sourceViewOf(app.fronds, (e) => home.get(lowerFirst(e)) === name)) ?? [];
        lines.push(...behind.map((line) => `${name}: ${line}`));
      }

      return lines;
    },
    // Every source, the default one last: a named source may hold what the default refers
    // to, and closing in reverse of opening is the rule everywhere else.
    close: async () => {
      for (const engine of [...engines.values()].reverse()) await engine.close?.();
      await base?.close?.();
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
export function layerOf(storage: ResolvedStorage) {
  return {
    storageFactory: storage.storageFactory,
    sourceOf: storage.sourceOf,
    transacts: storage.transacts,
    enforces: storage.enforces,
    transacted: storage.transacted as never,
    pending: storage.pending,
  };
}
