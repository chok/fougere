/**
 * Fougere server bootstrap — single entry point for app lifecycle in Nuxt.
 *
 * Default path (zero-config): fougere.config.ts declares `db: 'sqlite'` and
 * everything else; this module auto-resolves the storage handle, builds an
 * ormFactory, runs auto-DDL from the entities, and boots the app.
 *
 * Escape hatch: `configureFougere({ db, ormFactory })` can be called from a
 * Nitro plugin if the user wants a custom data layer (alternative driver,
 * managed migrations, etc.).
 */
import { createApp, loadCascadedConfig, setModuleLoader, Logger } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import type { App, EntityOrm, FougereConfig, Transport } from '@fougere/core';
import { applyCreate, applyUpdate, type SchemaLike } from '@fougere/schema';

// ── Public types ─────────────────────────────────

export interface FougereServerConfig {
  /** Storage handle. Forwarded to the auth provider via AuthContext.db. */
  db?: unknown;
  /** Per-entity ORM factory. */
  ormFactory?: (entity: SchemaLike, name: string) => EntityOrm;
  /** Called after app is created. Use for migrations, seeding, etc. */
  afterBoot?: (app: App) => void | Promise<void>;
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

  log.info('booting (Nuxt/Nitro)');

  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

  // Config cascades along the workspace→app frontier: the workspace root (via
  // FOUGERE_ROOT, where `remotes`/shared db live) is the base, the app (cwd)
  // overrides. Same boundary the fronds cascade along. No `root` → both equal.
  const configRoot = process.cwd();
  const root = process.env.FOUGERE_ROOT ?? configRoot;
  const fileConfig: FougereConfig = await loadCascadedConfig(root, configRoot);

  // Auto-resolve the data layer from config.db when the user didn't provide a
  // custom one via configureFougere. The resolution itself lives in @fougere/runtime
  // — this host must not know which storage package backs `db:`.
  let db = _config.db;
  let ormFactory = _config.ormFactory;
  let migrateSchema: ((app: never) => Promise<void> | void) | undefined;
  if (!ormFactory) {
    const { resolveStorage } = await import('@fougere/runtime');
    const storage = resolveStorage(fileConfig.db as never);
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
    log.debug('running afterBoot');
    await _config.afterBoot(app);
    log.info('afterBoot done');
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
 * lifecycle rules: `auto()` stamped nothing, a declared default stayed absent. The
 * same page therefore behaved one way here and another way on SQLite.
 *
 * It reads the axes now, through the one realization every storage shares.
 */
function createMemoryOrm(entity: SchemaLike, _name: string): EntityOrm {
  const fields = entity.getFields();
  const pk = Object.entries(fields).find(([, field]) => field.role?.primary)?.[0] ?? 'id';
  const store = new Map<string, Record<string, unknown>>();
  const matches = (row: Record<string, unknown>, criteria: Record<string, unknown>) =>
    Object.entries(criteria).every(([key, value]) => Object.is(row[key], value));
  return {
    client: store,
    async list(options?: any) {
      let items = [...store.values()];
      if (options?.where) items = items.filter((row) => matches(row, options.where));
      const limit = options?.limit;
      const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;
      if (offset > 0) items = items.slice(offset);
      const hasMore = limit ? items.length > limit : false;
      if (limit) items = items.slice(0, limit);
      const result = items as any;
      result.hasMore = hasMore;
      result.endCursor = items.length > 0 ? String((items[items.length - 1] as any)[pk] ?? '') : undefined;
      if (options?.count) result.total = store.size;
      return result;
    },
    async findById(id: string) { return store.get(id); },
    async findBy(criteria: Record<string, unknown>) {
      return [...store.values()].find((row) => matches(row, criteria));
    },
    async findAllBy(criteria: Record<string, unknown>) {
      return [...store.values()].filter((row) => matches(row, criteria));
    },
    async create(input: Partial<Record<string, unknown>>) {
      const record = applyCreate(fields, input);
      const id = record[pk] as string;
      store.set(id, record);
      return record;
    },
    async update(id: string, input: Partial<Record<string, unknown>>) {
      const existing = store.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      const updated = { ...existing, ...applyUpdate(fields, input), [pk]: id };
      store.set(id, updated);
      return updated;
    },
    async delete(id: string) { return store.delete(id); },
    output(_schema: SchemaLike) { return this; },
  };
}
