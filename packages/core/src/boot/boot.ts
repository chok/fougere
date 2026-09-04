import { createApp } from './bootstrap.js';
import { seeding } from './seed.js';
import { scanProject } from '../scan/scanner.js';
import { loadConfig, type FougereConfig } from '../config-loader.js';
import { Logger } from '../builtins/logger.js';
import { applyConfig } from './apply.js';
import type { App, CreateAppOptions } from './types.js';
import { migrating, type Extension } from './AppLifecycle.js';
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
  /** Carries an announced fact out of this process. */
  onEmit?: CreateAppOptions['onEmit'];
  /**
   * storage setup — returns the storage handle (db), an storageFactory, and its two halves.
   * The `db` value is forwarded to the auth provider via AuthContext when `auth` is set.
   */
  db?: (config: FougereConfig) => {
    db?: unknown;
    storageFactory: CreateAppOptions['storageFactory'];
    /** Bring the schema up to date — an extension's `up`, because it runs after the container. */
    migrate?: (app: App) => Promise<void> | void;
    /** Closes what the factory opened — `boot()` called it, so `boot()` releases it. */
    close?: () => Promise<void>;
  };
  /**
   * What this app takes on beyond its fronds. Appended after the framework's own, so a
   * host adds to the ascent — or replaces a member of it by declaring the same name.
   */
  extensions?: readonly (Extension | undefined)[];
}

/** Boot a Fougere app from fougere.config.ts. */
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
    // boot() lives on the Node entry, so boot() is what reads the disk. `createApp` is
    // handed the answer and reaches for nothing.
    scan: await scanProject(root, options.fronds, config.conventions),
    createContainer: options.createContainer,
    storageFactory: dbSetup?.storageFactory,
    db: dbSetup?.db,
    auth: config.auth,
    remotes: options.remotes,
    ports: config.ports,
    // Read from the config for the same reason `ports` is, one line up: it is a fact the
    // project states, not one the caller passes. Absent here, `serveRest` and
    // `serveGraphQL` both answered `pass` on an app whose config declared them — the
    // hosts got it right through their own boot (`app/shared/src/boot.ts`), and this
    // path, the conventional one, served nothing.
    adapters: config.adapters,
    // boot() called the factory, so boot() owns closing what it opened. Not an extension:
    // it was opened before the container existed, so it closes after the container goes.
    onDispose: dbSetup?.close,
    /** The whole ascent, in one ordered list — tables, then rows, then whatever the host takes on. */
    extensions: [
      migrating(dbSetup?.migrate),
      seeding((message) => log.debug(message)),
      ...(options.extensions ?? []),
    ],
    onEmit: options.onEmit,
    remoteTransport: options.remoteTransport,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}
