import { Logger, applyConfig, createApp, type App, type CreateAppOptions, type Extension, type FougereConfig, type FrondDescriptor, type Transport } from '@fougere/core';
import { getModuleLoader, loadConfig, remotesOf, statedModules, statementFileIn, statementIn, type ModuleLoader, type Statement } from '@fougere/core/node';
import { createJiti } from 'jiti';
import { join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import type { Container } from '@fougere/container';

interface BootOptions {
  /** Project root. Defaults to process.cwd(). */
  root?: string;
  /** Override config (merged with fougere.config.ts). */
  config?: Partial<FougereConfig>;
  /** The container to resolve through. Absent, core builds its own. */
  createContainer?: () => Container;
  /**
   * Boot only these fronds, by name — absent, every one found. Not `fronds:`, which says what
   * an app is MADE of: this narrows the same list to what one process carries.
   */
  only?: string[];
  /** @deprecated The name `only:` now carries. */
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
  /** The data layer, built from the config — a factory, and the two halves it owes the boot. */
  storage?: (config: FougereConfig) => {
    storageFactory: CreateAppOptions['storageFactory'];
    /** What the schema lacks, read — the boot refuses on it and never writes. */
    pending?: (app: App) => Promise<string[]>;
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

  let layer: ReturnType<NonNullable<BootOptions['storage']>> | undefined;
  if (options.storage) {
    log.debug('opening the sources');
    layer = options.storage(config);
    log.info('sources opened');
  }

  // What the config names by module — imported here, because core resolves no specifier.
  const stated = await statedModules(config.fronds, fromProject(root));
  const only = options.only ?? options.fronds;
  // Every boot starts from a statement: the one the project wrote, or the one the scan writes for it.
  const statement = await statementOf(root, { conventions: config.conventions });
  const hosted = [...statement.fronds, ...stated.fronds].filter((frond) => !only || only.includes(frond.name));

  log.debug('creating app');
  const app = await createApp({
    fronds: hosted,
    vocabulary: statement.vocabulary,
    createContainer: options.createContainer,
    storageFactory: layer?.storageFactory,
    // The tree's string leaves say the same thing `remotes:` does, and this boot read
    // neither of them from the file until now — a project stating its topology got a
    // process that believed every frond was local.
    remotes: options.remotes ?? remotesOf(config),
    // Who inherits code from whom — handed over whole, because a refusal names where an
    // entry sits in the tree.
    under: config.fronds,
    narrowed: only !== undefined,
    ports: config.ports,
    conventions: config.conventions,
    // Read from the config for the same reason `ports` is, one line up: it is a fact the
    // project states, not one the caller passes. Absent here, `serveRest` and
    // `serveGraphQL` both answered `pass` on an app whose config declared them — the
    // hosts got it right through their own boot (`app/shared/src/boot.ts`), and this
    // path, the conventional one, served nothing.
    protocols: config.protocols,
    state: config.state,
    // boot() called the factory, so boot() owns closing what it opened. Not an extension:
    // it was opened before the container existed, so it closes after the container goes.
    onDispose: layer?.close,
    // Read, never written: the boot refuses a database behind the entities, and writing it
    // is `fougere migrate --apply`.
    pending: layer?.pending,
    extensions: [...stated.extensions, ...(options.extensions ?? [])],
    onEmit: options.onEmit,
    remoteTransport: options.remoteTransport,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}

/**
 * A package a config names — `'@fougere/log'` — resolved from the PROJECT, whose dependency it is:
 * core's own loader takes it for a file path. A path goes to whatever loader the caller installed,
 * which knows the project's aliases.
 */
function fromProject(root: string): ModuleLoader {
  const project = createJiti(pathToFileURL(resolve(root) + sep).href, { interopDefault: true });

  return (id, options) => (id.startsWith('.') || id.startsWith('/')
    ? getModuleLoader()(id, options)
    : project.import(id) as Promise<Record<string, unknown>>);
}

/**
 * The statement a project boots from — the `fronds.ts` it wrote, or the one the scan writes for it
 * when it wrote none. Every host starts from one, so what booted in dev is what boots in a build.
 */
export async function statementOf(
  root: string,
  scope: { only?: readonly string[]; conventions?: FougereConfig['conventions'] } = {},
): Promise<Statement> {
  return statementIn(statementFileIn(root) ?? await written(root, scope.conventions), scope.only);
}

/**
 * Scanned for a project that wrote no statement. The compiler is the one package that needs a
 * TypeScript program, so it is imported here and only here — and what it could not settle is said here.
 * Where it is not installed — a production install, which leaves dev dependencies out — the statement
 * the BUILD wrote is what boots: `@fougere/vite` and `@fougere/next` write it beside their facade.
 */
async function written(root: string, conventions: FougereConfig['conventions']): Promise<string> {
  const log = new Logger('boot');
  const built = join(root, '.fougere', 'fronds.generated.ts');
  // A production server boots from what its build wrote, whether or not the compiler came along:
  // `next start` runs in the install that built it, and scanning there would load TypeScript.
  if (process.env.NODE_ENV === 'production' && existsSync(built)) return built;
  const compiler = await import('@fougere/compiler').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;

    return undefined;
  });
  if (!compiler) {
    if (existsSync(built)) return built;
    throw new Error(`${root} has no fronds.ts and @fougere/compiler is not installed. Run \`fougere build\`, or install @fougere/compiler.`);
  }
  const { file, diagnostics } = await compiler.writeStatement(root, conventions);
  for (const d of diagnostics.filter((one) => one.severity === 'blocking')) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  return file;
}
