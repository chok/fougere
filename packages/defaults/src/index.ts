/** @fougere/defaults — the conventional boot, declared once. */
import { migrating, type App, type CreateAppOptions } from '@fougere/core';
import { boot } from './boot.js';
import { loadConfig, remotesOf } from '@fougere/core/node';
import { resolveStorage, type ResolvedStorage } from './storage/ResolvedStorage.js';
import '@fougere/transport-http';

export { boot, statementOf } from './boot.js';
export type { Statement } from '@fougere/core/node';
export { declaresStorage } from './storage/DeclaredStorage.js';
export { layerOf, resolveStorage, storageFrom } from './storage/ResolvedStorage.js';
export type { SourceEntities } from './storage/SourceEntities.js';
export type { ResolvedStorage } from './storage/ResolvedStorage.js';

export interface BootAppOptions {
  /** Boot only these fronds, by name. Absent = every discovered frond. */
  only?: string[];
  /** @deprecated The name `only:` now carries. */
  fronds?: string[];
  /**
   * What this app takes on beyond its fronds; a member with the same name replaces the framework's.
   * Ex: `observability()`.
   */
  extensions?: CreateAppOptions['extensions'];
  /**
   * This process writes its own schema at boot, for a database born with it.
   * Ex: `path: ':memory:'`.
   */
  migrates?: boolean;
  /** Where `fougere build` wrote the project as JavaScript — read instead of the sources. */
  built?: string;
}

/** Boots the app at `root` the conventional way. */
export async function bootApp(root: string, opts: BootAppOptions = {}): Promise<App> {
  const config = await loadConfig(opts.built ?? root);
  const served = new Set(opts.only ?? opts.fronds ?? []);
  const elsewhere = Object.fromEntries(Object.entries(remotesOf(config)).filter(([frond]) => !served.has(frond)));
  let storage: ResolvedStorage | undefined;

  return boot({
    root,
    built: opts.built,
    only: opts.only ?? opts.fronds,
    remotes: elsewhere,
    storage: (cfg) => (storage = resolveStorage(cfg.sources, root)),
    extensions: [...(opts.migrates ? [migrating((app) => storage?.migrate?.(app))] : []), ...(opts.extensions ?? [])],
  });
}
