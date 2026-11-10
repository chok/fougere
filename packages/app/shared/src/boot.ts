/** Fougere server bootstrap — single entry point for an app's lifecycle, whatever hosts it. */
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyConfig, createApp, Logger, migrating } from '@fougere/core';
import { resolveConventions } from '@fougere/core';
import { frondAliases, loadNearestConfig, remotesOf, setModuleLoader, configModules } from '@fougere/core/node';

import type { App, AuthRuntime, CreateAppOptions, FougereConfig, Transport } from '@fougere/core';
import { authOf } from './auth.js';
import { layerOf, appOptionsOf, type ResolvedStorage } from '@fougere/defaults';


export interface FougereServerConfig {
  /** The whole data layer, as `resolveStorage` composed it. */
  storage?: ResolvedStorage;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: CreateAppOptions['extensions'];
  /** What the boot line names as the host — 'Nuxt/Nitro', 'Next'. */
  host?: string;
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: CreateAppOptions['fronds'];
  /** What the process answers by name, exported beside the fronds a statement states. */
  vocabulary?: CreateAppOptions['vocabulary'];
  /** What `fougere.config.ts` says, when the host already read it. */
  config?: Partial<FougereConfig>;
  /** Who performs an outgoing call, when the default cannot. */
  remoteTransport?: (url: string) => Transport;
  /**
   * This process writes its own schema at boot, for a database born with it.
   * Ex: `path: ':memory:'`.
   */
  migrates?: boolean;
}


let _config: FougereServerConfig = {};
let _configPromise: Promise<FougereConfig> | null = null;
let _appPromise: Promise<App> | null = null;
let _replaced: Promise<App>[] = [];


/** Overrides the data layer `sources:` would give. */
export function configureFougere(config: FougereServerConfig) {
  _config = config;
  replace();
}

/** Add to what is already stated, instead of replacing it. */
export function extendFougere(config: Partial<FougereServerConfig>) {
  _config = { ..._config, ...config };
  replace();
}

function replace() {
  if (_appPromise) _replaced.push(_appPromise);
  _appPromise = null;
  _configPromise = null;
}

/** What `fougere.config.ts` says, read once and without booting. */
export function useFougereConfig(): Promise<FougereConfig> {
  _configPromise ??= readConfig().catch((refusal: unknown) => {
    _configPromise = null;
    throw refusal;
  });

  return _configPromise;
}

async function readConfig(): Promise<FougereConfig> {
  if (_config.config) return _config.config as FougereConfig;

  await installLoader();

  return loadNearestConfig(process.cwd());
}

function reads(): boolean {
  return _config.fronds === undefined || _config.config === undefined;
}

async function installLoader(alias?: Record<string, string>): Promise<void> {
  if (!reads()) return;
  const { createJiti } = await import('jiti');
  const jiti = createJiti(pathToFileURL(resolve(process.cwd()) + sep).href, { interopDefault: true, ...(alias ? { alias } : {}) });
  setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);
}

/** The booted app: boots on first call and keeps it; a refusal is not kept. */
export function useFougereApp(): Promise<App> {
  if (!_appPromise) {
    _appPromise = boot().catch((refusal: unknown) => {
      _appPromise = null;
      throw refusal;
    });
  }

  return _appPromise;
}

/** Turn the ring. */
export async function reloadFougere(timeoutMs?: number): Promise<App> {
  replace();
  const previous = _replaced;
  _replaced = [];
  const next = await useFougereApp().catch((refusal: unknown) => {
    _replaced = [...previous, ..._replaced];
    throw refusal;
  });
  for (const replaced of previous) {
    const old = await replaced;
    await old.drain(timeoutMs);
    await old.dispose();
  }

  return next;
}


async function boot(): Promise<App> {
  const bootStart = performance.now();
  const log = new Logger('boot');

  log.info(`booting (${_config.host ?? 'app'})`);

  const root = process.env.FOUGERE_ROOT ?? process.cwd();
  const fileConfig = await useFougereConfig();
  applyConfig(fileConfig);

  const conventions = resolveConventions(fileConfig.conventions);
  if (reads()) await installLoader(await frondAliases(root, conventions));

  let storage = _config.storage;
  if (!storage) {
    const { resolveStorage } = await import('@fougere/defaults');
    storage = resolveStorage(fileConfig.sources, root);
  }

  const stated = await configModules(fileConfig.fronds);
  const remotes = remotesOf(fileConfig);
  const declared: Partial<Pick<CreateAppOptions, 'fronds' | 'vocabulary'>> = _config.fronds
    ? { fronds: _config.fronds, vocabulary: _config.vocabulary }
    : await appOptionsOf(root, { conventions: fileConfig.conventions });

  const app = await createApp({
    ...(declared.fronds || stated.fronds.length > 0 ? { fronds: [...(declared.fronds ?? []), ...stated.fronds] } : {}),
    ...(declared.vocabulary ? { vocabulary: declared.vocabulary } : {}),
    ...layerOf(storage),
    protocols: fileConfig.protocols,
    state: fileConfig.state,
    ports: fileConfig.ports,
    conventions: fileConfig.conventions,
    remotes,
    /** Who inherits code from whom — the tree, whole, so a refusal can name where an entry sits. */
    under: fileConfig.fronds,
    remoteTransport: _config.remoteTransport,
    extensions: [
      ...(_config.migrates ? [migrating((app) => storage.migrate?.(app))] : []),
      ...stated.extensions,
      ...(_config.extensions ?? []),
    ],
    onDispose: _config.storage ? undefined : storage.close,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)`);

  return app;
}

/** Get the auth runtime resolved at boot. Throws when no process-local frond brought one. */
export async function useFougereAuth(): Promise<AuthRuntime> {
  const auth = authOf(await useFougereApp());
  if (!auth) throw new Error("Auth not configured — declare `fronds: { '@fougere/auth-better': { … } }` in fougere.config.ts.");

  return auth;
}
