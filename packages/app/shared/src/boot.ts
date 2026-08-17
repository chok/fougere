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
import { createApp, loadCascadedConfig, setModuleLoader, frondAliases, Logger } from '@fougere/core';
import { createContainer } from '@fougere/container';
import type { App, EntityOrm, FougereConfig, Transport } from '@fougere/core';
import { applyCreate, applyUpdate, type SchemaView } from '@fougere/schema';

// ── Public types ─────────────────────────────────

export interface FougereServerConfig {
  /** Storage handle. Forwarded to the auth provider via AuthContext.db. */
  db?: unknown;
  /** Per-entity ORM factory. */
  ormFactory?: (entity: SchemaView, name: string) => EntityOrm;
  /** Called after app is created. Use for migrations, seeding, etc. */
  afterBoot?: (app: App) => void | Promise<void>;
  /**
   * What the boot line names as the host — 'Nuxt/Nitro', 'Next'. Stated by the
   * adapter, never sniffed: a boot that guesses its host from what happens to be
   * importable is the hidden runtime the doctrine refuses.
   */
  host?: string;
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

// ── Boot ─────────────────────────────────────────

async function boot(): Promise<App> {
  const bootStart = performance.now();
  const log = new Logger('boot', { level: 'debug' });

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
  let migrateSchema: ((app: never) => Promise<void> | void) | undefined;
  if (!ormFactory) {
    const { resolveStorage } = await import('@fougere/defaults');
    const storage = resolveStorage(fileConfig.db as never, (fileConfig as { sources?: unknown }).sources as never);
    if (storage.ormFactory) {
      log.debug('auto-resolving storage from config.db');
      db = storage.db;
      ormFactory = storage.ormFactory;
      migrateSchema = storage.afterBoot as never;
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
    remoteTransport = (url) => createHttpTransport(url);
  }

  const app = await createApp({
    root,
    createContainer,
    ormFactory,
    db,
    auth: fileConfig.auth,
    adapters: fileConfig.adapters,
    remotes: fileConfig.remotes,
    remoteTransport,
  });

  // Bring the schema up to date — creates missing tables and adds columns an
  // entity gained. Auth entities travel with the app, no synthetic frond needed.
  if (migrateSchema) {
    log.debug('migrating schema from entities');
    await migrateSchema(app as never);
  }

  if (_config.afterBoot) {
    // A host that declares `afterBoot` OWNS what happens after the boot, seeding
    // included — Nuxt's generated Nitro plugin does exactly that, because Nitro
    // bundles and the seed modules have to be spelled out as static imports for it.
    log.debug('running afterBoot');
    await _config.afterBoot(app);
    log.info('afterBoot done');
  } else {
    // Nobody claimed it, so the boot seeds. The scan already carries each seed's
    // data (`SeedEntry.data` is its resolved default export), and the order comes
    // from core — the same `orderSeeds`/`runSeeds` pair Nuxt's plugin calls. A host
    // that does not bundle its frond sources needs nothing else.
    const { orderSeeds, runSeeds } = await import('@fougere/core');
    await runSeeds(app, orderSeeds(app.fronds), (message) => log.info(`[seed]${message}`));
  }

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
