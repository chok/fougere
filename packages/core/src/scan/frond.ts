/**
 * A frond as the SCAN found it — one interface per convention directory, plus what the
 * run could not read.
 *
 * The declared side is `frond-config.ts`; this is the described one. They meet at
 * `FrondDescriptor.operationsOverrides`, where a declaration reaches the façade.
 */
import type { SchemaView } from '@fougere/schema';
import type { ParsedParam, OperationContract, OperationsMap } from '../wire/operation.js';
import type { PresenterViews } from '../prefab/presenter.js';
import type { Fronds } from './Fronds.js';

/**
 * A discovered provider — a class under `services/` or `repositories/`, injected by type.
 *
 * Which of the two directories it came from is deliberately not recorded. The scan used
 * to tag it `kind: 'service' | 'repository'`, a field it filled on every provider and
 * that **no consumer ever read** — the two directories are two spellings of the same
 * thing, and DI resolves by type either way.
 */
export interface ProviderEntry {
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
