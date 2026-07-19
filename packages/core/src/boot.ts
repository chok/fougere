import { createApp } from './bootstrap.js';
import { loadConfig, type FougereConfig } from './config-loader.js';
import { Logger } from './builtins/logger.js';
import type { App, CreateAppOptions } from './types.js';
import type { Container } from '@fougere/container';

export interface BootOptions {
  /** Project root. Defaults to process.cwd(). */
  root?: string;
  /** Override config (merged with fougere.config.ts). */
  config?: Partial<FougereConfig>;
  /** Container factory. Required. */
  createContainer: () => Container;
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
  const log = new Logger('boot', { level: 'debug' });

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
        const handler = app.resolve<Record<string, Function>>(`${seed.entityName}Handler`);

        // Seed via handler facade. list() accepts optional InvocationContext.
        const existing = await handler.list() as unknown[];
        if (existing.length === 0) {
          if (typeof handler.create === 'function') {
            for (const item of data) await handler.create({ params: {}, query: {}, body: item, state: {} });
          } else {
            // No create on handler — seed via ORM directly
            const ormName = `${seed.entityName[0].toUpperCase()}${seed.entityName.slice(1)}Orm`;
            try {
              const orm = app.resolve<{ create: (input: unknown) => Promise<unknown> }>(ormName);
              for (const item of data) await orm.create(item);
            } catch {
              log.warn(`  ${seed.entityName}: no create handler or ORM — skipping seed`);
              continue;
            }
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
