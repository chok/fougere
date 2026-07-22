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
import type { SchemaLike } from '@fougere/schema';

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

  // Auto-resolve the data layer from config.db when the user didn't provide
  // a custom one via configureFougere. Today only 'sqlite' is supported.
  let db = _config.db;
  let ormFactory = _config.ormFactory;
  let sqlite: { exec(sql: string): void } | undefined;
  if (!ormFactory) {
    const dbConf = fileConfig.db;
    if (dbConf === 'sqlite' || (typeof dbConf === 'object' && dbConf?.dialect === 'sqlite')) {
      log.debug('auto-resolving SQLite storage');
      const { setupSqlite } = await import('@fougere/schema-drizzle');
      const path = typeof dbConf === 'object' ? dbConf.path : undefined;
      const setup = setupSqlite({ path });
      db = setup.db;
      ormFactory = setup.ormFactory;
      sqlite = setup.sqlite;
    } else if (dbConf === false || dbConf === undefined) {
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

  // Auto-DDL from scanned entities + auth entities (when SQLite is involved).
  if (sqlite) {
    log.debug('running auto-DDL from entities');
    const { autoMigrate } = await import('@fougere/schema-drizzle');
    const fronds = [...app.fronds];
    if (app.auth?.entities) {
      const authEntities = Object.entries(app.auth.entities).map(([name, entityClass]) => ({
        name,
        entityClass,
      }));
      fronds.push({ name: '__auth__', entities: authEntities } as never);
    }
    autoMigrate({ fronds }, sqlite);
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

function createMemoryOrm(_entity: SchemaLike, _name: string): EntityOrm {
  const store = new Map<string, Record<string, unknown>>();
  return {
    async list(options?: any) {
      let items = [...store.values()];
      const limit = options?.limit;
      const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;
      if (offset > 0) items = items.slice(offset);
      const hasMore = limit ? items.length > limit : false;
      if (limit) items = items.slice(0, limit);
      const result = items as any;
      result.hasMore = hasMore;
      result.endCursor = items.length > 0 ? String((items[items.length - 1] as any).id ?? '') : undefined;
      if (options?.count) result.total = store.size;
      return result;
    },
    async findById(id: string) { return store.get(id); },
    async create(input: Partial<Record<string, unknown>>) {
      const id = input.id as string ?? crypto.randomUUID();
      const record = { ...input, id };
      store.set(id, record);
      return record;
    },
    async update(id: string, input: Partial<Record<string, unknown>>) {
      const existing = store.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      const updated = { ...existing, ...input, id };
      store.set(id, updated);
      return updated;
    },
    async delete(id: string) { return store.delete(id); },
    output(_schema: SchemaLike) { return this; },
  };
}
