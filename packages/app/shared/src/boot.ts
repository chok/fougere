import { Role } from '@fougere/schema';
import { Lifecycle } from '@fougere/schema';
/**
 * Fougere server bootstrap — single entry point for an app's lifecycle,
 * whatever hosts it.
 *
 * Nothing here knows h3, Nitro, Vue or React: a boot reads `fougere.config.ts`,
 * scans fronds off the filesystem and hands back an `App`. That is why it lives
 * in `@fougere/app` rather than in one of the two adapters — the second host
 * would otherwise have copied it, and a copied boot drifts (the seeding loop
 * already did, `core/src/boot/seed.ts`).
 *
 * Default path (zero-config): fougere.config.ts declares `db: 'sqlite'` and
 * everything else; this module auto-resolves the storage handle, builds an
 * storageFactory, runs auto-DDL from the entities, and boots the app.
 *
 * Escape hatch: `configureFougere({ db, storageFactory })` can be called from the
 * host's own startup (a Nitro plugin, a Next instrumentation hook) if the user
 * wants a custom data layer — alternative driver, managed migrations, etc.
 */
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
  /**
   * What this app takes on beyond its fronds, each stating what it does and what it undoes.
   *
   * It replaced `afterBoot`, which a host used to CLAIM the whole post-boot to get its own
   * seeding — Nuxt's generated plugin did exactly that, and its copy of the seeding loop
   * drifted. Declaring `{ name: 'seeds', up }` replaces that one member and leaves the
   * rest of the ascent alone.
   */
  extensions?: CreateAppOptions['extensions'];
  /**
   * What the boot line names as the host — 'Nuxt/Nitro', 'Next'. Stated by the
   * adapter, never sniffed: a boot that guesses its host from what happens to be
   * importable is the hidden runtime the doctrine refuses.
   */
  host?: string;
  /**
   * What this app is built from, when the host already knows.
   *
   * Absent, `boot()` reads the fronds off the disk — right on a server, impossible on a
   * runtime that has none: measured on workerd, `readdir` throws through unenv's shim and
   * the app comes up with ZERO fronds, so every page renders and every door answers
   * NOT_FOUND. A host that scanned at BUILD time can say so instead, and `fougere build`
   * writes exactly this value down.
   *
   * Same slot as `CreateAppOptions.scan` and for the same reason: producing the value
   * reads a disk, consuming it does not.
   */
  scan?: CreateAppOptions['scan'];
  /**
   * What this app STATES it hosts — `frond('blog', { entities: [Post] })`.
   *
   * Stating this and no `scan` is how a host stops scanning at boot: nothing reads a
   * disk, nothing loads `typescript`, and what was not named does not exist. It is the
   * one door Next, Vite, React, Svelte and a bare Express share — none of them scans on
   * its own, they all arrive here, and this line used to end in a scan for every one.
   */
  fronds?: CreateAppOptions['fronds'];
  /**
   * What `fougere.config.ts` says, when the host already read it.
   *
   * The same rule as `scan`, and found the same way: `boot()` re-reads the file at
   * runtime, which a Worker cannot do — measured, a consumer's `remotes:` never reached
   * the boot and its pages rendered empty with nothing said. A host that read the config
   * at BUILD time states it here instead.
   *
   * `auth` is deliberately not part of what a codegen'd host can carry: it holds a live
   * provider, not a value. An app that authenticates reads its own config.
   */
  config?: Partial<FougereConfig>;
  /**
   * Who performs an outgoing call, when the default cannot.
   *
   * `boot()` builds an HTTP transport from `remotes:` and that is right nearly
   * everywhere. It is not right on Cloudflare: a Worker calling a sibling's public URL
   * is refused by the edge with error 1042, so two Workers of one account reach each
   * other through a SERVICE BINDING and through nothing else. A binding is a value only
   * the host holds, so only the host can state this.
   *
   * It replaces the default entirely — signing included, since a host that builds its
   * own transport is the one that knows what to put on the wire.
   */
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

/**
 * Add to what is already stated, instead of replacing it.
 *
 * A host states its app in PIECES when the pieces are known at different moments: a
 * build writes the scan and the config into a generated plugin, and a value only the
 * running process holds — a Cloudflare service binding — cannot be written there at all.
 * Its dual is `configureFougere`, which replaces; `reloadFougere` depends on that
 * replacement, so merging silently would have broken the turn of the ring.
 */
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

/**
 * Turn the ring: instantiate the app again, then let the previous one go.
 *
 * This is what "reload" means for anything the config CONSUMED — a value that built
 * something cannot move under what it built, so the thing is built again. Its dual is
 * `applyConfig`, for values that are merely consulted and need no turn at all.
 *
 * Every door reaches the app through `useFougereApp()` inside the request it serves and
 * none holds it across two, which is what makes the swap invisible: the next request
 * lands on the new app whether or not the old one has finished being released.
 *
 * A call already running finishes on the OLD app: it is drained before being released,
 * so nothing has its storage closed underneath it. `timeoutMs` bounds that wait, and a
 * drain that runs out REJECTS — the app is left alone rather than released under work,
 * because a caller who cannot wait must choose that on purpose.
 */
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
    /**
     * The whole ascent, one ordered list: tables, then rows, then what the host adds.
     * A host wanting its OWN seeding declares `{ name: 'seeds', … }` and replaces that
     * member — it no longer has to claim everything after the boot to get it.
     */
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

