import { createApp } from './bootstrap.js';
import { loadConfig, type FougereConfig } from './config-loader.js';
import { Logger, type LogLevel } from './builtins/logger.js';
import type { App, CreateAppOptions } from './types.js';
import type { Transport } from './call.js';
import type { Container } from '@fougere/container';

export interface BootOptions {
  /** Project root. Defaults to process.cwd(). */
  root?: string;
  /** Override config (merged with fougere.config.ts). */
  config?: Partial<FougereConfig>;
  /** Container factory. Required. */
  createContainer: () => Container;
  /** Only boot these fronds (by name). Absent = all. */
  fronds?: string[];
  /**
   * Remote fronds — label → address. A declared remote wins over local
   * presence (the frond runs elsewhere). Requires `remoteTransport`.
   */
  remotes?: Record<string, string>;
  /** Builds the transport to reach `remotes`. Supplied by a layer-2 package. */
  remoteTransport?: (url: string) => Transport;
  /**
   * ORM setup — returns the storage handle (db), an ormFactory and an optional afterBoot.
   * The `db` value is forwarded to the auth provider via AuthContext when `auth` is set.
   */
  db?: (config: FougereConfig) => {
    db?: unknown;
    ormFactory: CreateAppOptions['ormFactory'];
    afterBoot?: (app: App) => Promise<void> | void;
  };
}

/**
 * Boot a Fougere app from fougere.config.ts.
 *
 * Handles: config loading, container creation, DB setup, seeding.
 * Works for any surface (Nuxt, GraphQL standalone, CLI, tests).
 */
export async function boot(options: BootOptions): Promise<App> {
  const bootStart = performance.now();
  const log = new Logger('boot', { level: (process.env.FOUGERE_LOG_LEVEL as LogLevel | undefined) ?? 'debug' });

  const root = options.root ?? process.cwd();
  log.info(`root: ${root}`);

  log.debug('loading config');
  const fileConfig = await loadConfig(root);
  const config: FougereConfig = { ...fileConfig, ...options.config };
  log.info('config loaded');

  let dbSetup: ReturnType<NonNullable<BootOptions['db']>> | undefined;
  if (options.db) {
    log.debug('initializing database');
    dbSetup = options.db(config);
    log.info('database initialized');
  }

  log.debug('creating app (scan + container)');
  const app = await createApp({
    root,
    createContainer: options.createContainer,
    ormFactory: dbSetup?.ormFactory,
    db: dbSetup?.db,
    auth: config.auth,
    fronds: options.fronds,
    remotes: options.remotes,
    remoteTransport: options.remoteTransport,
  });

  if (dbSetup?.afterBoot) {
    log.debug('running migrations');
    await dbSetup.afterBoot(app);
    log.info('migrations done');
  }

  // Run seeds
  const seedCount = app.fronds.reduce((n, f) => n + f.seeds.length, 0);
  if (seedCount > 0) {
    log.debug(`seeding ${seedCount} entities`);
    for (const frond of app.fronds) {
      for (const seed of frond.seeds) {
        const resolve = <T>(name: string) => app.resolve<T>(name + 'Handler');
        const data = typeof seed.data === 'function' ? await seed.data(resolve) : seed.data;

        // A seed is not a client: it writes at boot, from inside. The façade is
        // used when the entity declares one (its judge catches a bad seed
        // early), the ORM when it does not — an entity that exposes nothing is
        // still an entity whose reference rows must land.
        const tryResolve = <T>(name: string): T | undefined => {
          try { return app.resolve<T>(name); } catch { return undefined; }
        };
        const handler = tryResolve<Record<string, Function>>(`${seed.entityName}Handler`);
        const ormName = `${seed.entityName[0].toUpperCase()}${seed.entityName.slice(1)}Orm`;
        const orm = tryResolve<{ list: () => Promise<unknown[]>; create: (input: unknown) => Promise<unknown> }>(ormName);

        const canRead = typeof handler?.list === 'function' ? handler : orm;
        if (!canRead) {
          log.warn(`  ${seed.entityName}: no handler façade nor ORM — skipping seed`);
          continue;
        }

        // list() accepts optional InvocationContext; ListResult IS an array.
        const existing = await canRead.list() as unknown[];
        if (existing.length === 0) {
          if (typeof handler?.create === 'function') {
            for (const item of data) await handler.create({ params: {}, query: {}, body: item, state: {} });
          } else if (orm) {
            for (const item of data) await orm.create(item);
          } else {
            log.warn(`  ${seed.entityName}: no create handler or ORM — skipping seed`);
            continue;
          }
          log.debug(`  ${seed.entityName}: ${Array.isArray(data) ? data.length : '?'} records`);
        } else {
          log.debug(`  ${seed.entityName}: skipped (${existing.length} exist)`);
        }
      }
    }
    log.info('seeding done');
  }

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}
