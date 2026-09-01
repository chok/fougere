/**
 * What a frond is made of — one interface per convention directory.
 *
 * Produced two ways and indistinguishable once here: the scan DERIVES it from a
 * directory tree, `frond()` STATES it outright. `frond-config.ts` is the declared
 * side; they meet at `FrondDescriptor.operationsOverrides`.
 */
import type { SchemaView } from '@fougere/schema';
import type { Param, OperationContract, OperationsMap } from '../wire/operation.js';
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
  /**
   * The class constructor (default export of the file).
   *
   * `never[]` and not `unknown[]`: the arguments are the CONTAINER's to supply, so the
   * slot must accept any constructor — and with `unknown[]` a real class is refused,
   * because assigning it would need `unknown` to be one of its declared parameters.
   * Invisible on the scan path, where the value arrives as `unknown` and is cast; the
   * module `fougere build` writes states the class by name, and that is where it showed.
   */
  ctor: new (...args: never[]) => unknown;
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
  ctor: new (...args: never[]) => unknown;
  /** All operations with full signatures for binding. */
  operations: OperationsMap;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this handler is part of the frond's public contract. */
  exposed?: boolean;
  /** Output schema override — when Crud(Entity, Output), restricts storage output. */
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
   * A computed field that declares `user?: User` is then fed by the collector
   * that resolves one. A presenter is not a second mechanism.
   */
  params?: Param[];
}

/** A discovered presenter (computed fields for an entity's output). */
export interface PresenterEntry {
  /** Entity name this presenter enriches (e.g. 'post' from PostPresenter). */
  entityName: string;
  /** The presenter class. */
  ctor: new (...args: never[]) => unknown;
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
  /** Registration key of the TYPE this collector resolves — 'user', 'ability'. */
  typeName: string;
  /** The collector class. */
  ctor: new (...args: never[]) => unknown;
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
  /** The @fronds/{name} package name. Always present. */
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
