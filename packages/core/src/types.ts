import type { Container } from '@fougere/container';
import type { EntityOrm, OrmFactory } from './orm.js';
import type { SchemaLike } from '@fougere/schema';
import type { OperationContract, OperationsMap } from './operation.js';
import type { AppMiddleware } from './middleware.js';
import type { PresenterViews } from './presenter.js';
import type { Transport } from './call.js';

/**
 * A discovered provider — a class under `services/` or `repositories/`, injected by type.
 *
 * Which of the two directories it came from is deliberately not recorded. The scan used
 * to tag it `kind: 'service' | 'repository'`, a field it filled on every provider and
 * that **no consumer ever read** — the two directories are two spellings of the same
 * thing, and DI resolves by type either way.
 */
export interface ProviderEntry {
  /** Registration key: class name with first letter lowercased. */
  name: string;
  /** The class constructor (default export of the file). */
  ctor: new (...args: unknown[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}

/** A discovered entity (Entity subclass in entities/ dir). */
export interface EntityEntry {
  /** Registration key: class name lowercased first char (e.g. 'product'). */
  name: string;
  /** The Entity class (has static getFields()). */
  entityClass: SchemaLike;
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this entity is part of the frond's public contract. */
  exposed?: boolean;
}

/** A discovered handler (controls what a service exposes). */
export interface HandlerEntry {
  /** Registration key (e.g. 'postHandler'). */
  name: string;
  /** Entity name this handler controls (e.g. 'post' from PostHandler). */
  entityName: string;
  /** The handler class. */
  ctor: new (...args: unknown[]) => unknown;
  /** All operations with full signatures for binding. */
  operations: OperationsMap;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this handler is part of the frond's public contract. */
  exposed?: boolean;
  /** Output schema override — when Crud(Entity, Output), restricts ORM output. */
  outputOverride?: SchemaLike;
  /** Surface name — subdirectory in handlers/ (e.g. 'admin', 'public'). */
  surface?: string;
}

/** Return type metadata for a presenter computed field. */
export interface PresenterFieldMeta {
  name: string;
  /** Inferred return type name: 'string', 'number', 'boolean', or a class name. */
  returnType?: string;
  /** Whether the return is nullable. */
  nullable?: boolean;
}

/** A discovered presenter (computed fields for an entity's output). */
export interface PresenterEntry {
  /** Entity name this presenter enriches (e.g. 'post' from PostPresenter). */
  entityName: string;
  /** The presenter class. */
  ctor: new (...args: unknown[]) => unknown;
  /** Computed field names (method names on prototype). */
  fields: string[];
  /** Per-field type metadata (inferred from source via parser). */
  fieldMeta: PresenterFieldMeta[];
  /**
   * The view each computed field emits, when the presenter declares one
   * (`Presenter(Order, { items: [OrderItemView] })`). Stated rather than inferred: the
   * parser reads a scalar off a return type and nothing more, so an object-valued field
   * has no derivable shape without this.
   */
  views?: PresenterViews;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}

/** A discovered collector (resolves handler input params from invocation context). */
export interface CollectorEntry {
  /** Entity name this collector resolves (e.g. 'user' from UserCollector). */
  entityName: string;
  /** The collector class. */
  ctor: new (...args: unknown[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}

/** A discovered seed file (array of records or async factory). */
export interface SeedEntry {
  /** Entity name this seed targets (from filename: Author.seed.ts → 'author'). */
  entityName: string;
  /** Raw default export — array or function. Resolved at runtime. */
  data: Record<string, unknown>[] | SeedFactory;
  /** Absolute file path (for debugging). */
  filePath: string;
}

/** Seed factory — receives a resolver to access handlers cross-frond. */
export type SeedFactory = (resolve: <T>(name: string) => T) => Promise<Record<string, unknown>[]>;

/** Where a frond lives on disk. */
export interface FrondSource {
  /** Absolute path to the frond directory. */
  path: string;
  /** The @frond/{name} package name. Always present. */
  package: string;
}

export interface FrondDescriptor {
  name: string;
  source: FrondSource;
  providers: ProviderEntry[];
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  collectors: CollectorEntry[];
  seeds: SeedEntry[];
  /** Per-surface entity lists from frond.config.ts (e.g. { graphql: ['Post'], rest: ['Post', 'Author'] }). */
  surfaces?: Record<string, string[]>;
  /**
   * Per-operation overrides from frond.config.ts. Key = operation name.
   *
   * Two depths, as declared on {@link OperationOverride}: the surface keys travel to the
   * transport adapters, the contract keys (`input`/`output`/`binding`) travel to the
   * façade — where config is the third producer of an operation's contract, alongside a
   * prefab's `__ops` and the scan.
   */
  operationsOverrides?: Record<string, OperationContract & {
    kind?: 'query' | 'command';
    /** Class name to resolve from DI (overrides default `{Entity}Handler` lookup). */
    handlerName?: string;
    /** Method name on the resolved handler (defaults to op name). */
    method?: string;
    /** CASL ability string for opt-in policy check. */
    policy?: string;
  }>;
}

/** Result of scanning a project directory. */
export interface ScanResult {
  fronds: FrondDescriptor[];
}

/**
 * Lazy auth declaration written in fougere.config.ts.
 *
 * Each @fougere/auth-* package exports a factory (e.g. `betterAuth(opts)`) that
 * returns this shape. The `create()` method is called once at boot with the
 * resolved db + ormFactory, so the provider can wire its engine through Fougere.
 */
export interface AuthConfig {
  /** Build the runtime — invoked by createApp at boot with the resolved storage handles. */
  create(ctx: AuthContext): AuthRuntime | Promise<AuthRuntime>;
  /**
   * Entities the provider will use. Optional metadata — useful for the core's
   * future migration registry to know which tables auth needs.
   */
  entities?: Record<string, SchemaLike>;
}

/**
 * Context passed by the core to an auth provider's create() function.
 * Provides the resources the provider needs to integrate with the app.
 */
export interface AuthContext {
  /** Storage handle (Kysely DB instance, Prisma client, etc.) — opaque to core. */
  db: unknown;
  /** Per-entity ORM factory — auth provider uses this to back its adapter. */
  ormFactory: OrmFactory;
}

/**
 * Runtime returned by an auth provider's create(config, ctx) function.
 * The core mounts this on the App and the HTTP layer (Nuxt module / router) uses it.
 */
export interface AuthRuntime {
  /** Entities used by the provider, including any defaults it filled in. */
  entities: Record<string, SchemaLike>;
  /**
   * Per-entity ORMs the provider built for itself. Exposed so app code can
   * query auth tables (e.g. list active sessions for a user) without rebuilding
   * the same EntityOrm.
   */
  orms: Record<string, EntityOrm>;
  /** Web Standard handler that processes /auth/* requests. */
  handler: (request: Request) => Promise<Response>;
  /** Programmatic API exposed by the provider (getSession, signOut, ...). */
  api: Record<string, unknown>;
  /** Effective mount path (echoes config.basePath or the provider's default). */
  basePath: string;
}

/** Options for createApp(). */
export interface CreateAppOptions {
  /** Project root directory. Defaults to process.cwd(). */
  root?: string;
  /** Factory function to create the container. Required. */
  createContainer: () => Container;
  /** Factory to auto-generate EntityOrm for each scanned entity. */
  ormFactory?: OrmFactory;
  /** Only load these fronds (by name). If absent, load all. */
  fronds?: string[];
  /**
   * Remote fronds — label → address. What each remote hosts is discovered
   * at the first miss (rpc.discover), never declared here.
   */
  remotes?: Record<string, string>;
  /**
   * Builds the transport used to reach `remotes` addresses. Wired by
   * layer-2 packages (e.g. @fougere/transport-http); required when
   * `remotes` is non-empty.
   */
  remoteTransport?: (url: string) => Transport;
  /**
   * Storage handle to expose to the auth provider via AuthContext.db.
   * Required when `auth` is set.
   */
  db?: unknown;
  /** Auth declaration to wire into the app at boot. */
  auth?: AuthConfig;
}

/** The App object returned by createApp(). */
export interface App {
  /** Root container with builtins + frond scopes. */
  container: Container;
  /** Discovered fronds metadata. */
  fronds: FrondDescriptor[];
  /** Resolve from root container (shortcut). */
  resolve<T>(name: string): T;
  /**
   * Resolve an entity's schema — the local `entityClass` when it's hosted or
   * scanned here, else reconstructed from the remote's identity card
   * (rpc.discover → reconstruct()). The one way to get a live schema for an
   * entity whose class may not be importable at all (another repo, another
   * language) — a card travelled, but until now its `schema` was thrown away.
   */
  schemaFor(entity: string): Promise<SchemaLike>;
  /**
   * The façade an entity exposes to one audience, or `undefined` when it
   * exposes none. A named surface is CLOSED: an entity with no façade of its
   * own under that surface is not in it — it never falls back to the full one.
   *
   * The one way an adapter reaches a façade. It exists so the key format stays
   * inside core (see `facadeKeyOf`), which is what lets a projection package
   * stay structurally typed and depend on nothing.
   */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /**
   * The storage an entity is backed by, resolved through its owning frond's scope —
   * the dual of {@link facadeFor}. `undefined` when no loaded frond hosts the entity,
   * or when the app booted with no storage at all.
   *
   * `unknown` because the port belongs to whoever wired it: narrowing it to `EntityOrm`
   * is the caller saying which implementation they are standing on.
   */
  ormFor(entity: string): unknown | undefined;
  /** Dispose the root container. */
  dispose(): Promise<void>;
  /** Register a global app middleware (runs on every operation). */
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to a specific entity. */
  use(entity: string, middleware: AppMiddleware): void;
  /** Auth runtime, present when fougere.config.ts declares `auth`. */
  auth?: AuthRuntime;
}
