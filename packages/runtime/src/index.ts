/**
 * @fougere/runtime — the conventional boot, declared once.
 *
 * Booting an app from `fougere.config.ts` means the same three opinionated
 * bindings every time: the container is `container-fougere`, `db: sqlite`
 * realizes through `schema-drizzle`, and `remotes:` are reached over
 * `transport-http`. core stays pure (it knows none of these); this layer-2
 * package supplies them on top of `core.boot()`. Nuxt's fallback, the CLI's
 * `serve`/`call`, and a standalone frond host are all projections of it.
 */
import { boot, loadConfig, type App } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { setupSqlite, autoMigrate } from '@fougere/schema-drizzle';
import { createHttpTransport } from '@fougere/transport-http';

export interface BootAppOptions {
  /** Boot only these fronds (by name). Absent = every discovered frond. */
  fronds?: string[];
  /**
   * Follow `remotes:` from config (default true). A host process (`serve`)
   * passes false — it *is* the frond, it doesn't route back out.
   */
  topology?: boolean;
}

/**
 * Boot a Fougere app from the `fougere.config.ts` at `root`, wired the
 * conventional way (container-fougere + sqlite + http remotes).
 */
export async function bootAppFromConfig(root: string, opts: BootAppOptions = {}): Promise<App> {
  const config = await loadConfig(root);
  const remotes = config.remotes ?? {};
  const useRemotes = (opts.topology ?? true) && Object.keys(remotes).length > 0;

  return boot({
    root,
    createContainer,
    fronds: opts.fronds,
    remotes: useRemotes ? remotes : undefined,
    remoteTransport: useRemotes ? (url) => createHttpTransport(url) : undefined,
    db: (cfg) => {
      const dbConf = cfg.db;
      // `db: false` — a frond with no persistence of its own.
      if (dbConf === false) return { ormFactory: undefined };
      const path = typeof dbConf === 'object' ? dbConf.path : undefined;
      const { db, sqlite, ormFactory } = setupSqlite({ path });
      return { db, ormFactory, afterBoot: (app) => autoMigrate(app, sqlite) };
    },
  });
}
