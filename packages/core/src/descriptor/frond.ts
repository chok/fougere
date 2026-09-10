/** What a frond is made of — one interface per convention directory. */
import type { SchemaView } from '@fougere/schema';
import type { Param, OperationContract, OperationsMap } from '../wire/operation.js';
import type { PresenterViews } from '../prefab/presenter.js';
import type { Fronds } from './Fronds.js';

/** A discovered provider — a class under `services/` or `repositories/`, injected by type. */
export interface ProviderEntry {
  /**
   * The container key — the class name as the SOURCE spells it.
   *
   * Read at boot off `ctor.name` for a decade of no consequence, until a bundler lowered
   * a `static readonly` field and renamed the declaration doing it: the provider
   * registered as `_Communes` and the handler asking for `Communes` got a container miss.
   * A name a tool may rewrite is written down, for the same reason `deps` is.
   */
  name?: string;
  /** The class constructor (default export of the file). */
  ctor: new (...args: never[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}

/**
 * The key a provider answers under. What the source said, and the class's own name only
 * where nobody wrote it down — a statement is read as code, and code can say it.
 */
export const nameOf = (provider: ProviderEntry): string => provider.name ?? provider.ctor.name;

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
   * The name this handler answers to — its class name minus `Handler`, lowercased (`PostHandler` →
   * `post`).
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
  /** The field emits a LIST per row — `tags(posts: Post[]): string[][]`. */
  list?: boolean;
  /** Whether the return is nullable. */
  nullable?: boolean;
  /** The declared parameters AFTER the rows. */
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
   * The view each computed field emits, when the presenter declares one (`Presenter(Order, {
   * items: [OrderItemView] })`).
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

/**
 * A discovered middleware — a class declaring `around(ctx, next)`, which runs before and
 * after every operation in its scope.
 */
export interface MiddlewareEntry {
  /** Class name — what `frond.config.ts` addresses to widen the scope. */
  name: string;
  /** The middleware class. */
  ctor: new (...args: never[]) => unknown;
  /** How far it reaches: its own frond's entities, or every operation in the process. */
  scope: 'frond' | 'app';
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
  middlewares: MiddlewareEntry[];
  /**
   * Brought by an EXTENSION rather than by the app — `@fougere/calls` keeping its lines,
   * `@fougere/observability` sending them on. It is installed like any other, and it is not
   * what the app SERVES: a report that lists it describes the instrumentation, not the
   * domain. Set by the boot, never by a declaration.
   */
  brought?: true;
  /**
   * Per-surface entity lists from frond.config.ts (e.g. { graphql: ['Post'], rest: ['Post',
   * 'Author'] }).
   */
  surfaces?: Record<string, string[]>;
  /** Entities this frond may read across sources — see `FrondConfig.reads`. */
  reads?: string[];
  /** Per-operation overrides from frond.config.ts. */
  operationsOverrides?: Record<string, OperationContract & {
    kind?: 'query' | 'command';
    /** Class name to resolve from DI (overrides default `{Entity}Handler` lookup). */
    handlerName?: string;
    /** Method name on the resolved handler (defaults to op name). */
    method?: string;
  }>;
}
