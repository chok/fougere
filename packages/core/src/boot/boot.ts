import { createApp } from './bootstrap.js';
import { orderSeeds, runSeeds } from './seed.js';
import { loadConfig, type FougereConfig } from '../config-loader.js';
import { Logger } from '../builtins/logger.js';
import { applyConfig } from './apply.js';
import type { App, CreateAppOptions } from './types.js';
import type { Transport } from '../wire/call.js';
import type { Container } from '@fougere/container';

interface BootOptions {
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
    /** Closes what the factory opened — `boot()` called it, so `boot()` releases it. */
    close?: () => Promise<void>;
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
  const log = new Logger('boot');

  const root = options.root ?? process.cwd();
  log.info(`root: ${root}`);

  log.debug('loading config');
  const fileConfig = await loadConfig(root);
  const config: FougereConfig = { ...fileConfig, ...options.config };
  // What this config changes in the process, said the same way at boot and at reload —
  // there is one applier, and a host re-reading later calls the very same function.
  applyConfig(config);
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
    ports: config.ports,
    // boot() called the factory, so boot() owns closing what it opened.
    onDispose: dbSetup?.close,
    remoteTransport: options.remoteTransport,
  });

  if (dbSetup?.afterBoot) {
    log.debug('running migrations');
    await dbSetup.afterBoot(app);
    log.info('migrations done');
  }

  // Run seeds — in dependency order, so a referrer never lands before its target.
  const seeds = orderSeeds(app.fronds);
  if (seeds.length > 0) {
    log.debug(`seeding ${seeds.length} entities: ${seeds.map((s) => s.entityName).join(' → ')}`);
    await runSeeds(app, seeds, (message) => log.debug(message));
    log.info('seeding done');
  }

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}
