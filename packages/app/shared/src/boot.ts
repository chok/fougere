import { Role } from '@fougere/schema';
import { Lifecycle } from '@fougere/schema';
/** Fougere server bootstrap — single entry point for an app's lifecycle, whatever hosts it. */
import { createApp, identityFromEnv, Logger, migrating, seeding } from '@fougere/core';
import { scanProject, loadCascadedConfig, setModuleLoader, frondAliases, resolveConventions } from '@fougere/core/node';
import type { Extension } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { createMemoryStorage } from '@fougere/adapter-memory';
import type { App, CreateAppOptions, Storage, FougereConfig, Transport } from '@fougere/core';
import { applyCreate, applyUpdate, type SchemaView } from '@fougere/schema';

// ── Public types ─────────────────────────────────

export interface FougereServerConfig {
  /** Storage handle. Forwarded to the auth provider via AuthContext.db. */
  db?: unknown;
  /** Per-entity storage factory. */
  storageFactory?: (entity: SchemaView, name: string) => Storage;
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
  // both its scan and its config has nothing left to load, and jiti cannot run where
  // there is no module resolver: measured on workerd, `createJiti` threw
  // `Cannot read properties of undefined (reading 'paths')` and every request answered
  // 500 — the loader was being built for files that no longer needed opening.
  const reads = _config.scan === undefined || _config.config === undefined;
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
  const conventions = resolveConventions(fileConfig.conventions);
  // `frondAliases` reads a directory listing, so it is asked only when the loader it
  // feeds is going to exist at all.
  if (reads) installLoader(await frondAliases(root, conventions));

  // Auto-resolve the data layer from config.db when the user didn't provide a
  // custom one via configureFougere. The resolution itself lives in @fougere/defaults
  // — this host must not know which storage package backs `db:`.
  let db = _config.db;
  let storageFactory = _config.storageFactory;
  // The storage's two halves, kept together: its ascent is an extension, its connection
  // is not — it is opened here, before the container, so it closes after the container.
  let storageMigrate: Extension['up'] | undefined;
  let closeStorage: (() => Promise<void>) | undefined;
  // Where the rows are, and how to open a transaction there — read from the same storage
  // resolution, because a frame's realization is decided by `sources:` and nothing else.
  let sourceOf: ((entityName: string) => string) | undefined;
  let transacted: CreateAppOptions['transacted'];
  if (!storageFactory) {
    const { resolveStorage } = await import('@fougere/defaults');
    const storage = resolveStorage(fileConfig.db as never, (fileConfig as { sources?: unknown }).sources as never);
    if (storage.storageFactory) {
      log.debug('auto-resolving storage from config.db');
      db = storage.db;
      storageFactory = storage.storageFactory;
      sourceOf = storage.sourceOf;
      transacted = storage.transacted as never;
      storageMigrate = storage.migrate;
      closeStorage = storage.close;
    } else {
      log.debug('no db declared — falling back to in-memory storage');
      storageFactory = createMemoryStorage;
    }
  }

  // Layer-2 wiring: `remotes: { catalog: 'http://...' }` in fougere.config.ts
  // is all the user writes — the default transport comes from here.
  // The host's word wins here too — and where it speaks, nothing below runs: building
  // the default would import the transport and read the environment for a key, both
  // pointless once the caller has said who carries the call.
  let remoteTransport: ((url: string) => Transport) | undefined = _config.remoteTransport;
  if (!remoteTransport && Object.keys(fileConfig.remotes ?? {}).length > 0) {
    log.debug(`remotes declared (${Object.keys(fileConfig.remotes!).join(', ')}) — wiring HTTP transport`);
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
    createContainer,
    storageFactory,
    sourceOf,
    transacted,
    db,
    auth: fileConfig.auth,
    adapters: fileConfig.adapters,
    remotes: fileConfig.remotes,
    remoteTransport,
    /** The whole ascent, one ordered list. */
    extensions: [
      // The slot is declared even when this host resolved no storage — a host that resolved
      // its own (the Nitro plugin does, for its bundler) then REPLACES this member in place
      // instead of adding one after the seeds, which is rows before tables.
      migrating(storageMigrate),
      seeding((message) => log.info(`[seed]${message}`)),
      ...(_config.extensions ?? []),
    ],
    // Opened before the container, so released after it. Never wired here until now:
    // this host boots the storage and no host closed one, which is what made a reload
    // leak the pool of every app it discarded.
    onDispose: closeStorage,
  });

  log.info(`ascent: ${app.extensions().join(' → ') || 'nothing declared'}`);

  const ms = (performance.now() - bootStart).toFixed(0);
  log.info(`ready in ${ms}ms — ${app.fronds.length} frond(s)${app.auth ? ` + auth (${app.auth.basePath})` : ''}`);

  return app;
}

