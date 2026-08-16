import type { Container } from '@fougere/container';
import type { Fronds } from './Fronds.js';
import type { ParsedParam } from './operation.js';
import type { EntityOrm, OrmFactory } from './orm.js';
import type { SchemaView } from '@fougere/schema';
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
  entityClass: SchemaView;
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this entity is part of the frond's public contract. */
  exposed?: boolean;
}

/** A discovered handler (controls what a service exposes). */
export interface HandlerEntry {
  /** Registration key (e.g. 'postHandler'). */
  name: string;
  /**
   * The name this handler answers to — its class name minus `Handler`, lowercased
   * (`PostHandler` → `post`). It is what `facadeKeyOf` builds its key from and what
   * travels as `FrondCall.entity` on the wire.
   *
   * **It is NOT an entity name**, and it was called `entityName` for long enough to
   * mislead: `toEntityName` (`scanner.ts`) strips the suffix without checking that any
   * entity carries the result, and the boot states the consequence — *pointing at
   * nothing is legal*. A health check, a search across several shapes, a pure
   * computation: ordinary handlers that own no row. `PresenterEntry`/`CollectorEntry`
   * keep `entityName` because those really do target a declared entity.
   */
  address: string;
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
  outputOverride?: SchemaView;
  /** Surface name — subdirectory in handlers/ (e.g. 'admin', 'public'). */
  surface?: string;
}

/** Return type metadata for a presenter computed field. */
export interface PresenterFieldMeta {
  name: string;
  /** Inferred return type name: 'string', 'number', 'boolean', or a class name. */
  returnType?: string;
  /**
   * The field emits a LIST per row — `tags(posts: Post[]): string[][]`.
   *
   * The method answers one value per row, so the outer array level of its return type is
   * the page, not the field: what remains after removing it is the field's own arity.
   * Nothing measured that remainder, so a computed list and a computed scalar looked
   * identical and every projection announced the scalar.
   */
  list?: boolean;
  /** Whether the return is nullable. */
  nullable?: boolean;
  /**
   * The declared parameters AFTER the rows. Kept raw rather than resolved: the scan
   * meets presenters before collectors, so the plan is computed at boot where the
   * collector names are known — exactly as a handler op's is.
   *
   * A computed field that declares `user: User | null` is then fed by the collector
   * that resolves one. A presenter is not a second mechanism.
   */
  params?: ParsedParam[];
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
  /** Entities this frond may read across sources — see `FrondConfig.reads`. */
  reads?: string[];
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
  }>;
}

/** Result of scanning a project directory. */
/**
 * Something the scan could NOT do — recorded instead of swallowed.
 *
 * The scan answers with what it found. Until now it answered the same way whether
 * a directory held nothing or could not be read, and whether a handler declared no
 * operation or failed to parse: `catch → empty`. So every downstream reader — the
 * façade, the identity card, anything asking "what does this app serve?" — could
 * not tell **"there is nothing"** from **"I could not look"**.
 *
 * That distinction is what makes a rule about an ABSENCE sound. Without it, a check
 * derived from the scan reports "nothing wrong" precisely when it read nothing.
 */
export interface ScanDiagnostic {
  /**
   * `blocking` — the app now serves less than its source declares, and no caller
   * can know it: a handler that failed to parse contributes zero operations.
   * `warning` — something may be missing and the scan cannot decide, e.g. a base
   * class it is not allowed to resolve. Statable in `frond.config.ts`.
   */
  severity: 'blocking' | 'warning';
  /** Stable rule name — `handler-parse-failed`, `directory-unreadable`. */
  code: string;
  /** Absolute path of what could not be read. */
  filePath: string;
  /** The frond it belongs to, when the scan got far enough to know. */
  frond?: string;
  /** What could not be done, and what it costs. One sentence, for a human. */
  message: string;
  /** The underlying failure, kept whole. */
  cause?: unknown;
}

export interface ScanResult {
  fronds: Fronds;
  /** What the scan could not do. Empty is a claim, not a default — see {@link ScanDiagnostic}. */
  diagnostics: ScanDiagnostic[];
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
  entities?: Record<string, SchemaView>;
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
  entities: Record<string, SchemaView>;
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
  /**
   * Builds the cross-source reader a frond gets when it declares `reads:`.
   *
   * A factory rather than a value, for the same reason `ormFactory` is one: core must
   * not name a storage package, and this one costs 71 MB of downloaded extensions and a
   * native module — nothing a first run that only wanted sqlite should carry. The host
   * decides what backs it; `@fougere/adapter-duckdb` is one answer, not the contract.
   *
   * Called once per frond that asks, with the entity CLASSES its `reads:` named — a
   * name would make the reader resolve the schema a second time.
   */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
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
   * Which protocol adapters this app serves — see `FougereConfig.adapters`.
   * Carried onto the App so every door reads one answer instead of each host
   * deciding for itself.
   */
  adapters?: Record<string, boolean | undefined>;
  /**
   * Carries an announced fact out of this process — a broker, a queue, a log.
   *
   * Called for every emission, ALONGSIDE the local dispatch and never instead of it: a
   * listener in this process is reached directly, and this is how the others hear.
   *
   * It exists because the local dispatch finds its listeners by having READ their code,
   * which stops at the repository boundary. A carrier hands the fact to a NAME; the far
   * side subscribes to that same name from its own code, and neither ever reads the other.
   *
   * Its failure never reaches the emitter — same rule as a subscriber's.
   */
  onEmit?: (fact: string, payload: unknown) => void | Promise<void>;
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
  /**
   * Which protocol adapters this app declared, from `fougere.config.ts`.
   *
   * Read by the doors themselves, so an undeclared adapter serves nothing whatever
   * the host mounted — the route file may exist, the middleware may be installed, and
   * the answer is still "not here".
   */
  adapters: Record<string, boolean | undefined>;
  /** Discovered fronds metadata. */
  fronds: Fronds;
  /** Resolve from root container (shortcut). */
  resolve<T>(name: string): T;
  /**
   * Resolve an entity's schema — the local `entityClass` when it's hosted or
   * scanned here, else reconstructed from the remote's identity card
   * (rpc.discover → reconstruct()). The one way to get a live schema for an
   * entity whose class may not be importable at all (another repo, another
   * language) — a card travelled, but until now its `schema` was thrown away.
   */
  schemaFor(entity: string): Promise<SchemaView>;
  /**
   * The door a name exposes to one audience, or `undefined` when it exposes
   * none. A named surface is CLOSED: a name with no door of its own under that
   * surface is not in it — it never falls back to the full one.
   *
   * **Not always a façade**, despite the name: when the owning frond is declared
   * remote, nothing is registered locally (`bootstrap.ts`, `declaredRemotes`) and
   * this resolves to a doublure — a façade-shaped stand-in (`remote.ts`). The
   * caller cannot tell, which is the point; the word here was simply wrong.
   *
   * The one way an adapter reaches that door. It exists so the key format stays
   * inside core (see `facadeKeyOf`), which is what lets a projection package
   * stay structurally typed and depend on nothing.
   */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /**
   * The facts this app has a listener for — what a carrier must subscribe to on its behalf.
   *
   * Derived from the signatures it scanned (`Fact<T>` in an op's parameters), so a process
   * states what it listens to without anyone declaring it twice. The dual of `onEmit`: one
   * says what leaves, this says what should be brought in.
   */
  listensTo(): string[];
  /**
   * Hand a fact that came from OUTSIDE to the listeners in this process — and stop there.
   *
   * The dual of `onEmit`, and deliberately not the same thing as announcing: resolving the
   * emission value to deliver an inbound fact would carry it straight back out through
   * `onEmit`, so a hub echoed every reading it received to the whole fleet. Receiving and
   * announcing are two operations; only one of them leaves.
   *
   * The local dispatch is identical either way — same judge, same binding, same
   * middlewares — so a fact off a wire is no less checked than one raised next door.
   *
   * **It waits, and it tells** — the opposite of announcing, on purpose. It resolves once
   * every listener here is done, and REJECTS with an `AggregateError` if any refused. A
   * carrier's whole job is to know whether the fact landed: at-least-once is retrying what
   * failed, so a delivery that cannot report makes durability impossible to build above it.
   * "Dispatch is not delivery" protects the EMITTER from a slow subscriber; a carrier is
   * not the emitter, it is the party whose business this is.
   *
   * It still holds nothing. A refused fact is refused, and whether it comes back is the
   * carrier's decision — Fougere puts the channel underneath rather than reimplementing it.
   */
  deliver(fact: string, payload: unknown): Promise<void>;
  /**
   * The storage an entity is backed by, resolved through its owning frond's scope —
   * the dual of {@link facadeFor}. `undefined` when no loaded frond hosts the entity,
   * or when the app booted with no storage at all.
   *
   * `unknown` because the port belongs to whoever wired it: narrowing it to `EntityOrm`
   * is the caller saying which implementation they are standing on.
   */
  ormFor(entity: string): unknown | undefined;
  /**
   * The presenter of an entity, resolved through its owning frond's scope.
   *
   * Same shape as {@link ormFor}, and it exists so an adapter never spells the container
   * key itself: `schema-graphql` wrote out `${Name}Presenter` by hand, and a key respelled
   * in a second place finds nothing and reports nothing the day the convention moves.
   */
  presenterFor(entity: string): unknown | undefined;
  /** Dispose the root container. */
  dispose(): Promise<void>;
  /**
   * The same disposal, spelled so the language does it: `await using app = await
   * createApp(…)`. Twelve of the twenty-six mounts in this repo's own tests never
   * called `dispose()` — a scope that closes itself is the only version of that
   * rule nobody forgets.
   */
  [Symbol.asyncDispose](): Promise<void>;
  /** Register a global app middleware (runs on every operation). */
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to a specific entity. */
  use(entity: string, middleware: AppMiddleware): void;
  /** Auth runtime, present when fougere.config.ts declares `auth`. */
  auth?: AuthRuntime;
}
