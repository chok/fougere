import { Logger, applyConfig, createApp, type App, type CreateAppOptions, type Extension, type FougereConfig, type FrondDescriptor, type Transport } from '@fougere/core';
import { layerOf, type ResolvedStorage } from './storage/ResolvedStorage.js';
import { getModuleLoader, loadConfig, MODULES, remotesOf, configModules, appOptionsFileIn, appOptionsIn, type ModuleLoader } from '@fougere/core/node';
import { join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import type { Container } from '@fougere/container';

interface BootOptions {
  /** Project root. Defaults to process.cwd(). */
  root?: string;
  /** Where `fougere build` wrote the project as JavaScript. */
  built?: string;
  /** Override config (merged with fougere.config.ts). */
  config?: Partial<FougereConfig>;
  /** The container to resolve through. Absent, core builds its own. */
  createContainer?: () => Container;
  /** Boots only these fronds, by name; absent, every one found. */
  only?: string[];
  /** @deprecated The name `only:` now carries. */
  fronds?: string[];
  /** Remote fronds, label → address; a declared remote wins over local presence. */
  remotes?: Record<string, string>;
  /** Replaces the transport every address of `remotes` names by its scheme. */
  remoteTransport?: (url: string) => Transport;
  /** Carries an announced fact out of this process. */
  onEmit?: CreateAppOptions['onEmit'];
  /** The data layer, built from the config — `boot()` called the factory, so `boot()` closes it. */
  storage?: (config: FougereConfig) => ResolvedStorage;
  /** What this app takes on beyond its fronds; a member with the same name replaces the framework's. */
  extensions?: readonly (Extension | undefined)[];
}

/** Boot a Fougere app from fougere.config.ts. */
export async function boot(options: BootOptions): Promise<App> {
  const bootStart = performance.now();
  const log = new Logger('boot');

  const root = options.root ?? process.cwd();
  log.info(`root: ${root}`);

  const code = options.built ?? root;
  log.debug('loading config');
  const fileConfig = await loadConfig(code);
  const config: FougereConfig = { ...fileConfig, ...options.config };
  applyConfig(config);
  log.info('config loaded');

  let layer: ReturnType<NonNullable<BootOptions['storage']>> | undefined;
  if (options.storage) {
    log.debug('opening the sources');
    layer = options.storage(config);
    log.info('sources opened');
  }

  const stated = await configModules(config.fronds, fromProject(root, options.built));
  const only = options.only ?? options.fronds;
  const statement = await appOptionsOf(code, { conventions: config.conventions });
  const hosted = [...statement.fronds, ...stated.fronds].filter((frond) => !only || only.includes(frond.name));

  log.debug('creating app');
  const app = await createApp({
    fronds: hosted,
    vocabulary: statement.vocabulary,
    createContainer: options.createContainer,
    ...(layer && layerOf(layer)),
    remotes: options.remotes ?? remotesOf(config),
    under: config.fronds,
    narrowed: only !== undefined,
    ports: config.ports,
    conventions: config.conventions,
    protocols: config.protocols,
    state: config.state,
    onDispose: layer?.close,
    extensions: [...stated.extensions, ...(options.extensions ?? [])],
    onEmit: options.onEmit,
    remoteTransport: options.remoteTransport,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}

function fromProject(root: string, built?: string): ModuleLoader {
  type Imports = (id: string) => Promise<Record<string, unknown>>;
  let project: Promise<Imports> | undefined;
  const imports = (): Promise<Imports> => project ??= built
    ? import(pathToFileURL(join(built, MODULES)).href).then(({ default: table }: { default: Record<string, () => Promise<Record<string, unknown>>> }) =>
      (id: string) => table[id]?.() ?? getModuleLoader()(id))
    : import('jiti').then(({ createJiti }) => {
      const jiti = createJiti(pathToFileURL(resolve(root) + sep).href, { interopDefault: true });

      return (id: string) => jiti.import(id) as Promise<Record<string, unknown>>;
    });

  return (id, options) => (!built && (id.startsWith('.') || id.startsWith('/'))
    ? getModuleLoader()(id, options)
    : imports().then((load) => load(id)));
}

/** The fronds and the vocabulary a project boots from: the `fronds.ts` it wrote, or the one the scan writes. */
export async function appOptionsOf(
  root: string,
  scope: { only?: readonly string[]; conventions?: FougereConfig['conventions'] } = {},
): Promise<Required<Pick<CreateAppOptions, 'fronds' | 'vocabulary'>>> {
  return appOptionsIn(appOptionsFileIn(root) ?? await written(root, scope.conventions), scope.only);
}

async function written(root: string, conventions: FougereConfig['conventions']): Promise<string> {
  const log = new Logger('boot');
  const built = join(root, '.fougere', 'fronds.generated.ts');
  if (process.env.NODE_ENV === 'production' && existsSync(built)) return built;
  const compiler = await import('@fougere/compiler').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;

    return undefined;
  });
  if (!compiler) {
    if (existsSync(built)) return built;
    throw new Error(`${root} has no fronds.ts and @fougere/compiler is not installed. Run \`fougere build\`, or install @fougere/compiler.`);
  }
  const { file, diagnostics } = await compiler.writeAppOptions(root, conventions);
  for (const d of diagnostics.filter((one) => one.severity === 'blocking')) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  return file;
}
