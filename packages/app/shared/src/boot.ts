/** Fougere server bootstrap — single entry point for an app's lifecycle, whatever hosts it. */
import { applyConfig, createApp, identityFromEnv, Logger } from '@fougere/core';
import { scanProject, frondAliases } from '@fougere/compiler';
import { resolveConventions } from '@fougere/core';
import { loadCascadedConfig, remotesOf, setModuleLoader, statedModules } from '@fougere/core/node';

import { createMemoryStorage } from '@fougere/adapter-memory';
import type { App, CreateAppOptions, FougereConfig, Transport } from '@fougere/core';
import { layerOf, type ResolvedStorage } from '@fougere/defaults';

// ── Public types ─────────────────────────────────

export interface FougereServerConfig {
  /**
   * The whole data layer, as `resolveStorage` composed it — where the rows are, which source
   * transacts, what to close. Handed over as ONE subject: a host that passed the factory alone
   * lost the transaction and the connection's owner, and nothing said so.
   */
  storage?: ResolvedStorage;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: CreateAppOptions['extensions'];
  /** What the boot line names as the host — 'Nuxt/Nitro', 'Next'. */
  host?: string;
  /** What this app is built from, when the host already knows. */
  scan?: CreateAppOptions['scan'];
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: CreateAppOptions['fronds'];
  /** What `fougere.config.ts` says, when the host already read it. */
  config?: Partial<FougereConfig>;
  /** Who performs an outgoing call, when the default cannot. */
  remoteTransport?: (url: string) => Transport;
}

// ── State ────────────────────────────────────────

let _config: FougereServerConfig = {};
let _appPromise: Promise<App> | null = null;

// ── Public API ───────────────────────────────────

/**
 * Override the data layer — only needed if you don't want the convention-driven
 * setup based on `config.db` in fougere.config.ts.
 */
export function configureFougere(config: FougereServerConfig) {
  _config = config;
  _appPromise = null;
}

/** Add to what is already stated, instead of replacing it. */
export function extendFougere(config: Partial<FougereServerConfig>) {
  _config = { ..._config, ...config };
  _appPromise = null;
}

/** Get the booted Fougere app. Lazy — boots on first call, then caches. */
export function useFougereApp(): Promise<App> {
  if (!_appPromise) {
    _appPromise = boot();
  }

  return _appPromise;
}

/** Turn the ring. */
export async function reloadFougere(timeoutMs?: number): Promise<App> {
  const previous = _appPromise;
  _appPromise = null;
  // The new one first: a boot that fails leaves the previous app serving, still whole.
  const next = await useFougereApp();
  if (previous) {
    const old = await previous;
    await old.drain(timeoutMs);
    await old.dispose();
  }

  return next;
}

// ── Boot ─────────────────────────────────────────

async function boot(): Promise<App> {
  const bootStart = performance.now();
  const log = new Logger('boot');

  log.info(`booting (${_config.host ?? 'app'})`);

  const { createJiti } = await import('jiti');
  // Nitro serves from a bundle, but the scan still reads frond sources from disk — so the
  // named form a frond uses for its neighbour has to resolve here too.
  //
  // Installed twice: the config names the scope the aliases are built from, so reading it
  // must not need them. Nothing in `fougere.config.ts` may import `@fronds/*`.
  //
  // And installed only when something is going to READ a source. A host that handed in
  // its config and its fronds — scanned or stated — has nothing left to load, and jiti cannot run where
  // there is no module resolver: measured on workerd, `createJiti` threw
  // `Cannot read properties of undefined (reading 'paths')` and every request answered
  // 500 — the loader was being built for files that no longer needed opening.
  const reads = (_config.scan === undefined && _config.fronds === undefined) || _config.config === undefined;
  const installLoader = (alias?: Record<string, string>): void => {
    if (!reads) return;
    const jiti = createJiti(import.meta.url, { interopDefault: true, ...(alias ? { alias } : {}) });
    setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);
  };
  installLoader();

  // Config cascades along the workspace→app frontier: the workspace root (via
  // FOUGERE_ROOT, where `remotes`/shared db live) is the base, the app (cwd)
  // overrides. Same boundary the fronds cascade along. No `root` → both equal.
  const configRoot = process.cwd();
  const root = process.env.FOUGERE_ROOT ?? configRoot;
  // The host's word wins, for the reason it wins on `scan`: it read the file already,
  // and where there is no file a second read finds nothing and says nothing.
  const fileConfig: FougereConfig = (_config.config as FougereConfig | undefined)
    ?? (await loadCascadedConfig(root, configRoot));
  // What a re-read config changes in a running process — the same call `boot()` makes in
  // core, and the only place `logLevel:` takes effect. Without it a web host read the key
  // and did nothing with it: the file said `debug` and the threshold stayed where the
  // module had left it.
  applyConfig(fileConfig);

  const conventions = resolveConventions(fileConfig.conventions);
  // `frondAliases` reads a directory listing, so it is asked only when the loader it
  // feeds is going to exist at all.
  if (reads) installLoader(await frondAliases(root, conventions));

  // Auto-resolve the data layer from config.db when the user didn't provide a
  // custom one via configureFougere. The resolution itself lives in @fougere/defaults
  // — this host must not know which storage package backs `db:`.
  let storage = _config.storage;
  if (!storage) {
    const { resolveStorage } = await import('@fougere/defaults');
    storage = resolveStorage(fileConfig.db as never, (fileConfig as { sources?: unknown }).sources as never, root);
    log.debug(storage.storageFactory ? 'auto-resolving storage from config.db' : 'no db declared — falling back to in-memory storage');
  }
  // The storage's two halves, kept together: its ascent is an extension, its connection
  // is not — it is opened here, before the container, so it closes after the container.

  // Layer-2 wiring: `remotes: { catalog: 'http://...' }` in fougere.config.ts
  // is all the user writes — the default transport comes from here.
  // The host's word wins here too — and where it speaks, nothing below runs: building
  // the default would import the transport and read the environment for a key, both
  // pointless once the caller has said who carries the call.
  let remoteTransport: ((url: string) => Transport) | undefined = _config.remoteTransport;
  // What the config names by module — imported here, because core resolves no specifier.
  const stated = await statedModules(fileConfig.fronds);
  const remotes = remotesOf(fileConfig);
  if (!remoteTransport && Object.keys(remotes).length > 0) {
    log.debug(`remotes declared (${Object.keys(remotes).join(', ')}) — wiring HTTP transport`);
    const { createHttpTransport } = await import('@fougere/transport-http');
    // A call that leaves this process carries a proof of who sent it, when the
    // deployment gave one. Without a key it travels as a bare claim, which only a
    // receiver that trusts no root will take.
    const { sign } = await identityFromEnv();
    remoteTransport = (url) => createHttpTransport(url, (sign ? { sign } : {}));
  }

  const app = await createApp({
    // The host's word wins: it scanned at build, and a second scan here would either
    // repeat that work or — where there is no disk — find nothing and say so quietly.
    // A host that names its fronds never reaches `scanProject` — that is what keeps
    // `typescript` out of a production boot. It may still hand over a scan of its own, and
    // then `hostedBy` merges the two: under Nuxt that scan is a BUILD artifact, so leaning
    // on it costs the runtime nothing. What is never done is scanning a disk BECAUSE a
    // statement was incomplete — half a statement would buy nothing the whole one does.
    ...(_config.fronds ? { fronds: _config.fronds } : {}),
    ...(_config.scan ? { scan: _config.scan } : {}),
    ...(!_config.fronds && !_config.scan
      ? { scan: await scanProject(root, undefined, conventions) }
      : {}),
    ...(stated.fronds.length > 0
      ? { fronds: [...(_config.fronds ?? []), ...stated.fronds] }
      : {}),
    // The layer, spread whole. Naming a few of its members is how `transacted` and `close`
    // were left behind once, under Nuxt only.
    ...layerOf(storage, createMemoryStorage),
    adapters: fileConfig.adapters,
    remotes,
    /** Who inherits code from whom — the tree, whole, so a refusal can name where an entry sits. */
    under: fileConfig.fronds,
    remoteTransport,
    extensions: [...stated.extensions, ...(_config.extensions ?? []), fileConfig.auth],
    // Opened before the container, so released after it. Never wired here until now:
    // this host boots the storage and no host closed one, which is what made a reload
    // leak the pool of every app it discarded.
    onDispose: storage.close,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)${fileConfig.auth ? ' + auth' : ''}`);

  return app;
}

