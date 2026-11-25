/** @fougere/defaults — the conventional boot, declared once. */
import { migrating, type App, type CreateAppOptions } from '@fougere/core';
import { boot } from './boot.js';
import { resolveStorage, type ResolvedStorage } from './storage/ResolvedStorage.js';
import '@fougere/transport-http';

export { boot, appOptionsOf } from './boot.js';
export { declaresStorage } from './storage/DeclaredStorage.js';
export { layerOf, resolveStorage, storageFrom } from './storage/ResolvedStorage.js';
export type { SourceEntities } from './storage/SourceEntities.js';
export type { ResolvedStorage } from './storage/ResolvedStorage.js';

export interface BootAppOptions {
  /** The process of `processes:` this boot is; absent, `FOUGERE_PROCESS`, else the app. */
  process?: string;
  /**
   * The app this boot is, by its directory under `apps/`, when it is no process.
   * Ex: `appNameOf(root, import.meta.dirname)`.
   */
  app?: string;
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
  let storage: ResolvedStorage | undefined;

  return boot({
    root,
    built: opts.built,
    process: opts.process,
    app: opts.app,
    storage: (cfg) => (storage = resolveStorage(cfg.sources, root)),
    extensions: [...(opts.migrates ? [migrating((app) => storage?.migrate?.(app))] : []), ...(opts.extensions ?? [])],
  });
}
