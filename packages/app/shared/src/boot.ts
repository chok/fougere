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
 * ormFactory, runs auto-DDL from the entities, and boots the app.
 *
 * Escape hatch: `configureFougere({ db, ormFactory })` can be called from the
 * host's own startup (a Nitro plugin, a Next instrumentation hook) if the user
 * wants a custom data layer — alternative driver, managed migrations, etc.
 */
import { createApp, identityFromEnv, Logger, migrating, seeding } from '@fougere/core';
import { scanProject, loadCascadedConfig, setModuleLoader, frondAliases } from '@fougere/core/node';
import type { Extension } from '@fougere/core';
import { createContainer } from '@fougere/container';
import type { App, CreateAppOptions, EntityOrm, FougereConfig, Transport } from '@fougere/core';
import { applyCreate, applyUpdate, type SchemaView } from '@fougere/schema';

// ── Public types ─────────────────────────────────

export interface FougereServerConfig {
  /** Storage handle. Forwarded to the auth provider via AuthContext.db. */
  db?: unknown;
  /** Per-entity ORM factory. */
  ormFactory?: (entity: SchemaView, name: string) => EntityOrm;
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
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: await frondAliases(process.env.FOUGERE_ROOT ?? process.cwd()),
  });
  setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

  // Config cascades along the workspace→app frontier: the workspace root (via
  // FOUGERE_ROOT, where `remotes`/shared db live) is the base, the app (cwd)
  // overrides. Same boundary the fronds cascade along. No `root` → both equal.
  const configRoot = process.cwd();
  const root = process.env.FOUGERE_ROOT ?? configRoot;
  const fileConfig: FougereConfig = await loadCascadedConfig(root, configRoot);

  // Auto-resolve the data layer from config.db when the user didn't provide a
  // custom one via configureFougere. The resolution itself lives in @fougere/defaults
  // — this host must not know which storage package backs `db:`.
  let db = _config.db;
  let ormFactory = _config.ormFactory;
  // The storage's two halves, kept together: its ascent is an extension, its connection
  // is not — it is opened here, before the container, so it closes after the container.
  let storageMigrate: Extension['up'] | undefined;
  let closeStorage: (() => Promise<void>) | undefined;
  // Where the rows are, and how to open a transaction there — read from the same storage
  // resolution, because a frame's realization is decided by `sources:` and nothing else.
  let sourceOf: ((entityName: string) => string) | undefined;
  let transacted: CreateAppOptions['transacted'];
  if (!ormFactory) {
    const { resolveStorage } = await import('@fougere/defaults');
    const storage = resolveStorage(fileConfig.db as never, (fileConfig as { sources?: unknown }).sources as never);
    if (storage.ormFactory) {
      log.debug('auto-resolving storage from config.db');
      db = storage.db;
      ormFactory = storage.ormFactory;
      sourceOf = storage.sourceOf;
      transacted = storage.transacted as never;
      storageMigrate = storage.migrate;
      closeStorage = storage.close;
    } else {
      log.debug('no db declared — falling back to in-memory ORM');
      ormFactory = createMemoryOrm;
    }
  }

  // Layer-2 wiring: `remotes: { catalog: 'http://...' }` in fougere.config.ts
  // is all the user writes — the default transport comes from here.
  let remoteTransport: ((url: string) => Transport) | undefined;
  if (Object.keys(fileConfig.remotes ?? {}).length > 0) {
    log.debug(`remotes declared (${Object.keys(fileConfig.remotes!).join(', ')}) — wiring HTTP transport`);
    const { createHttpTransport } = await import('@fougere/transport-http');
    // A call that leaves this process carries a proof of who sent it, when the
    // deployment gave one. Without a key it travels as a bare claim, which only a
    // receiver that trusts no root will take.
    const { sign } = await identityFromEnv();
    remoteTransport = (url) => createHttpTransport(url, { ...(sign ? { sign } : {}) });
  }

  const app = await createApp({
    // The host's word wins: it scanned at build, and a second scan here would either
    // repeat that work or — where there is no disk — find nothing and say so quietly.
    scan: _config.scan ?? (await scanProject(root)),
    createContainer,
    ormFactory,
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

// ── Fallback ORM ─────────────────────────────────

/**
 * The store an app with no `db` runs on.
 *
 * It used to ignore both its arguments — `(_entity, _name)` — so it forced the field
 * name `id`, minted a uuid whatever the entity declared, and realized none of the
 * lifecycle rules: `created()` stamped nothing, a declared default stayed absent. The
 * same page therefore behaved one way here and another way on SQLite.
 *
 * It reads the axes now, through the one realization every storage shares.
 */
export function createMemoryOrm(entity: SchemaView, name: string): EntityOrm {
  const fields = entity.getFields();
  const pk = Object.entries(fields).find(([, field]) => Role.of(field).isPrimary)?.[0] ?? 'id';
  const store = new Map<string, Record<string, unknown>>();
  // `EntityOrm.findById(id: string)` — but a key can hold a number, and a Map keyed on
  // `1` does not answer `'1'`. SQL never had the question; here the divergence was
  // silent and only on this storage.
  const keyOf = (value: unknown) => String(value);
  // Same contract as SQL: a criterion may name a SET, and an empty set matches nothing.
  const matches = (row: Record<string, unknown>, criteria: Record<string, unknown>) =>
    Object.entries(criteria).every(([key, value]) => Array.isArray(value)
      ? value.some((v) => Object.is(row[key], v))
      : Object.is(row[key], value));
  return {
    client: store,
    async list(options?: any) {
      let items = [...store.values()];
      if (options?.where) items = items.filter((row) => matches(row, options.where));
      // Held before the page is cut, and after the filter: `total` answers "how many
      // match", which is what a paginator divides. Reading `store.size` at the end
      // answered a different question — every row the store holds, including the ones
      // the filter exists to keep out of this caller's sight.
      const matching = items.length;
      const limit = options?.limit;
      const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;
      if (offset > 0) items = items.slice(offset);
      const hasMore = limit ? items.length > limit : false;
      if (limit) items = items.slice(0, limit);
      const result = items as any;
      result.hasMore = hasMore;
      result.endCursor = items.length > 0 ? String((items[items.length - 1] as any)[pk] ?? '') : undefined;
      if (options?.count) result.total = matching;
      return result;
    },
    async findById(id: string) { return store.get(keyOf(id)); },
    async findBy(criteria: Record<string, unknown>) {
      return [...store.values()].find((row) => matches(row, criteria));
    },
    async findAllBy(criteria: Record<string, unknown>) {
      return [...store.values()].filter((row) => matches(row, criteria));
    },
    // Same contract as SQL: a map keyed by the primary key, a miss being an absent key.
    async findByKeys(ids: readonly string[]) {
      const found = new Map<string, Record<string, unknown>>();
      for (const id of ids) {
        const row = store.get(keyOf(id));
        if (row) found.set(String(id), row);
      }
      return found;
    },
    // The dual, same contract as SQL: grouped by the value read off the ROW.
    async findAllByKeys(field: string, keys: readonly string[]) {
      const grouped = new Map<string, Record<string, unknown>[]>();
      if (keys.length === 0) return grouped;
      const wanted = new Set(keys.map(String));
      for (const row of store.values()) {
        const key = String(row[field]);
        if (!wanted.has(key)) continue;
        const held = grouped.get(key);
        if (held) held.push(row); else grouped.set(key, [row]);
      }
      return grouped;
    },
    // Same contract as SQL: the key and the creation stamps survive an overwrite.
    async upsert(input: Partial<Record<string, unknown>>) {
      const record = applyCreate(fields, applyUpdate(fields, input));
      const id = record[pk] as string | undefined;
      if (id === undefined) throw new Error(`${name}.upsert(): no \`${pk}\` — an upsert needs the key it writes at.`);
      const held = store.get(keyOf(id));
      if (held) {
        for (const [key, field] of Object.entries(fields)) {
          if (key === pk || Lifecycle.of(field).stampedOnce) record[key] = held[key];
        }
      }
      store.set(keyOf(id), record);
      return record;
    },
    async upsertAll(inputs: readonly Partial<Record<string, unknown>>[]) {
      for (const input of inputs) await (this as any).upsert(input);
      return inputs.length;
    },
    async create(input: Partial<Record<string, unknown>>) {
      const record = applyCreate(fields, input);
      const id = record[pk] as string | undefined;
      // `primary(text())` declares no generator, so nothing fills the hole and the
      // caller has to. Keying on `undefined` would let the second create overwrite the
      // first, in silence — the old version hid this by inventing an `id` field the
      // entity never declared.
      if (id === undefined) {
        throw new Error(`${name}.create: '${pk}' is the primary key and nothing supplied it — this entity declares no generator for it.`);
      }
      // A create is not an upsert. `Map.set` overwrites, so a second create under the
      // same key answered "created" while destroying the previous row — SQL answers a
      // constraint violation, and a store that loses data silently is worse than one
      // that fails.
      if (store.has(keyOf(id))) {
        throw new Error(`${name}.create: '${pk}' ${JSON.stringify(id)} already exists.`);
      }
      store.set(keyOf(id), record);
      return record;
    },
    async update(id: string, input: Partial<Record<string, unknown>>) {
      const existing = store.get(keyOf(id));
      if (!existing) throw new Error(`Not found: ${id}`);
      const updated = { ...existing, ...applyUpdate(fields, input), [pk]: existing[pk] };
      store.set(keyOf(id), updated);
      return updated;
    },
    async delete(id: string) { return store.delete(keyOf(id)); },
    output(_schema: SchemaView) { return this; },
  };
}
