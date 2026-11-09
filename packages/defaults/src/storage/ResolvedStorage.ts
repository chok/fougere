import type { App } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { FougereValue, FOUGERE_VALUE, Logger, Sources, sourceViewOf, type Constraint, type Source, type SourceConfig, type SourceView, type ValueSources } from '@fougere/core';
import { createMemorySource } from '@fougere/adapter-memory';
import type { SourceEntities } from './SourceEntities.js';

export interface ResolvedStorage {
  storageFactory: ((entity: any, name: string) => any) | undefined;
  /** The source an entity's rows live in. */
  sourceOf?: (entityName: string) => string | undefined;
  /** The rows of one source by its name, whichever entity they belong to. */
  factoryIn?: (source: string) => Source['storageFactory'] | undefined;
  /** The engine a source runs on. */
  dbOf?: (source: string) => unknown;
  /** Every source that has an engine, the default one first. */
  sources?: () => string[];
  /** Whether that source hands out a transaction — the dual of running one in it. */
  transacts?: (source: string) => boolean;
  /** Whether that source refuses a constraint at the rows — the dual of an entity declaring one. */
  enforces?: (source: string, constraint: Constraint) => boolean;
  /** Run `fn` inside one transaction of that source, with a storage factory bound to it. */
  transacted?: <R>(source: string, fn: (storageFactory: (entity: any, name: string) => any) => Promise<R>) => Promise<R>;
  /** Brings the schema up to date, and answers what it could not. */
  migrate?: (app: App) => Promise<string | void>;
  /** What `migrate` would create, READ — the dual the boot checks and never writes past. */
  pending?: (app: App) => Promise<string[]>;
  /** The entities held as one value each, and where each is read — absent when `values:` lists none. */
  values?: ValueSources;
  /** Close every engine this opened — the dual of opening them, declared by whoever did. */
  close?: () => Promise<void>;
  /** Raw synchronous handle, when the engine exposes one. */
}

/** The data layer from `sources:`; with no entry holding rows, they are kept in memory. */
export function resolveStorage(
  sources: Record<string, SourceConfig> | undefined,
  /** Where a relative `path:` is counted from: the directory of the config that named it. */
  root?: string,
): ResolvedStorage {
  const opened = Object.fromEntries(Object.entries(sources ?? {}).map(([name, entry]) => {
    const { rows, values, ...rest } = entry as { rows?: string[]; values?: string[] } & Record<string, unknown>;
    const readOnly = typeof rest.type === 'string' ? Sources.find(rest.type)?.readOnly : undefined;

    return [name, { source: Sources.open(anchored(rest, root), `sources.${name}`), rows, values, ...(readOnly && { readOnly }) }];
  }));

  return storageFrom(opened);
}

function anchored(entry: Record<string, unknown>, root?: string): Record<string, unknown> {
  const path = entry.path;
  if (!root || typeof path !== 'string' || path === ':memory:' || isAbsolute(path)) return entry;

  const anchoredPath = resolve(root, path);
  const beside = resolve(process.cwd(), path);
  if (beside !== anchoredPath && existsSync(beside) && !existsSync(anchoredPath)) {
    process.emitWarning(
      `${path} resolves to ${anchoredPath} beside the config that named it, and a database `
      + `already sits at ${beside}. Fougere opens the first; move the file, or write the path you mean.`,
    );
  }

  return { ...entry, path: anchoredPath };
}

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

function valuesHomeOf(sources: Record<string, SourceEntities>): Map<string, string> {
  const home = new Map<string, string>();
  for (const [name, placement] of Object.entries(sources)) {
    for (const entity of placement.values ?? []) {
      const key = lowerFirst(entity);
      const claimed = home.get(key);
      if (claimed) {
        throw new Error(`sources: '${entity}' is listed in the values: of both '${claimed}' and '${name}'. Keep it in one.`);
      }
      home.set(key, name);
    }
  }

  return home;
}

function valueSourcesOf(home: Map<string, string>, engineOf: (source: string) => Source): ValueSources {
  const rows = new Map<string, ReturnType<Source['storageFactory']>>();
  const valuesIn = (source: string) => {
    if (!rows.has(source)) rows.set(source, engineOf(source).storageFactory(FougereValue, FOUGERE_VALUE));

    return rows.get(source)!;
  };

  return {
    sourceOf: (entityName) => home.get(lowerFirst(entityName)),
    read: async (entityName, entity) => {
      const source = home.get(lowerFirst(entityName))!;
      const engine = engineOf(source);
      if (engine.value) return engine.value(entity, entityName);
      const row = await valuesIn(source).findById(entityName) as { value?: Record<string, unknown> } | null;

      return row?.value;
    },
    where: (entityName, entity, field) => {
      const source = home.get(lowerFirst(entityName))!;
      const at = engineOf(source).valueAt?.(entity, entityName, field) ?? `the ${FOUGERE_VALUE} row '${entityName}'`;

      return `sources.${source}, ${at}`;
    },
  };
}

/** The same routing `resolveStorage` performs, over engines the CALLER built. */
/** Where each entity's rows live, by source, and the engine of every source but the default. */
function placementsOf(sources: Record<string, SourceEntities>, fallback: string | undefined): { home: Map<string, string>; engines: Map<string, Source> } {
  const home = new Map<string, string>();
  const engines = new Map<string, Source>();
  for (const [name, placement] of Object.entries(sources)) {
    if (name === fallback) continue;
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

  return { home, engines };
}

export function storageFrom(sources: Record<string, SourceEntities>): ResolvedStorage {
  refuseRowsAndValues(sources);
  const fallback = defaultOf(sources);
  const DEFAULT = fallback?.[0];
  const base = fallback?.[1];

  const { home, engines } = placementsOf(sources, DEFAULT);

  const sourceOf = (entityName: string) => home.get(lowerFirst(entityName)) ?? DEFAULT;
  const engineOf = (source: string) => (DEFAULT !== undefined && source === DEFAULT ? base : engines.get(source));
  const engineFor = (entityName: string): Source => {
    const source = home.get(lowerFirst(entityName));
    const engine = (source && engines.get(source)) || base;
    if (!engine) throw new Error(`sources: no source holds '${entityName}'. Add it to the rows: of one.`);

    return engine;
  };
  const named = (): string[] => [...(DEFAULT ? [DEFAULT] : []), ...engines.keys()];
  const valuesHome = valuesHomeOf(sources);
  const viewOf = (app: Pick<App, 'fronds'>, source: string): SourceView => {
    const view = sourceViewOf(app.fronds, (name) => sourceOf(name) === source && !valuesHome.has(lowerFirst(name)));
    const engine = engineOf(source);
    if (!engine || engine.value || ![...valuesHome.values()].includes(source)) return view;

    return { ...view, entities: new Map([...view.entities, [FOUGERE_VALUE, FougereValue]]) };
  };

  return {
    storageFactory: (entity: any, name: string) => engineFor(name).storageFactory(entity, name),
    sourceOf,
    factoryIn: (source) => engineOf(source)?.storageFactory,
    dbOf: (source) => (engineOf(source) as { db?: unknown } | undefined)?.db,
    sources: named,
    transacts: (source) => engineOf(source)?.transacted !== undefined,
    enforces: (source, constraint) => engineOf(source)?.enforces?.includes(constraint) ?? false,
    transacted: async (source, fn) => {
      const engine = engineOf(source);
      if (!engine) throw new Error(`No source named '${source}'. Sources: ${named().join(', ')}.`);
      if (!engine.transacted) throw new Error(`Source '${source}' has no transactions.`);

      return engine.transacted(fn);
    },
    migrate: async (app) => {
      const said = DEFAULT ? [await base?.migrate?.(viewOf(app, DEFAULT))] : [];
      for (const [name, engine] of engines) {
        said.push(await engine.migrate?.(viewOf(app, name)));
      }
      const reports = said.filter((report): report is string => Boolean(report));

      return reports.length > 0 ? reports.join('\n') : undefined;
    },
    pending: async (app) => {
      const lines = DEFAULT ? [...(await base?.pending?.(viewOf(app, DEFAULT)) ?? [])] : [];
      for (const [name, engine] of engines) {
        const behind = await engine.pending?.(viewOf(app, name)) ?? [];
        lines.push(...behind.map((line) => `${name}: ${line}`));
      }

      return lines;
    },
    ...(valuesHome.size > 0 && { values: valueSourcesOf(valuesHome, (source) => engineOf(source)!) }),
    close: async () => {
      for (const engine of [...engines.values()].reverse()) await engine.close?.();
      await base?.close?.();
    },
  };
}

/** The data layer as `createApp` takes it. */
export function layerOf(storage: ResolvedStorage) {
  return {
    storageFactory: storage.storageFactory,
    sourceOf: storage.sourceOf,
    factoryIn: storage.factoryIn,
    transacts: storage.transacts,
    enforces: storage.enforces,
    transacted: storage.transacted as never,
    pending: storage.pending,
    values: storage.values,
  };
}
