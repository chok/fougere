/** @fougere/defaults — the conventional boot, declared once. */
import { type App, type CreateAppOptions } from '@fougere/core';
import { boot } from '@fougere/compiler';
import { loadConfig } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { createHttpTransport } from '@fougere/transport-http';
import { type DbConfig } from './storage/DbConfig.js';
import { resolveStorage } from './storage/ResolvedStorage.js';

export { declaresStorage } from './storage/DeclaredStorage.js';
export { layerOf, resolveStorage, storageFrom } from './storage/ResolvedStorage.js';
export type { DbConfig } from './storage/DbConfig.js';
export type { ResolvedStorage } from './storage/ResolvedStorage.js';

export interface BootAppOptions {
  /** Boot only these fronds (by name). Absent = every discovered frond. */
  fronds?: string[];
  /**
   * Follow `remotes:` from config (default true). A host process (`serve`)
   * passes false — it *is* the frond, it doesn't route back out.
   */
  topology?: boolean;
  /**
   * What this app takes on beyond its fronds — `observability()` is the first one.
   * Appended after the framework's own members, or replacing one by naming it.
   */
  extensions?: CreateAppOptions['extensions'];
}

/**
 * Boot a Fougere app from the `fougere.config.ts` at `root`, wired the
 * conventional way (container + sqlite + http remotes).
 */
export async function bootApp(root: string, opts: BootAppOptions = {}): Promise<App> {
  const config = await loadConfig(root);
  const remotes = config.remotes ?? {};
  const useRemotes = (opts.topology ?? true) && Object.keys(remotes).length > 0;

  return boot({
    root,
    createContainer,
    fronds: opts.fronds,
    remotes: useRemotes ? remotes : undefined,
    remoteTransport: useRemotes ? (url) => createHttpTransport(url) : undefined,
    // One resolver, one place that knows a storage package.
    db: (cfg) => resolveStorage(cfg.db as DbConfig, (cfg as { sources?: unknown }).sources as never, root),
    extensions: opts.extensions,
  });
}
