import type { SchemaLike } from '@fougere/schema';

/** Options for list queries — pagination, sorting, counting. */
export interface ListOptions {
  /** Number of records to return. */
  limit?: number;

  /** Offset-based: skip N records. */
  offset?: number;

  /** Page-based: 1-indexed page number (requires limit). */
  page?: number;

  /** Cursor-based: fetch records after this ID. */
  after?: string;

  /** Field name to order by. */
  orderBy?: string;

  /** Sort direction (default: 'asc'). */
  order?: 'asc' | 'desc';

  /** If true, also returns total count (for pagination UIs). */
  count?: boolean;

  /**
   * Equality criteria, field by field — `{ orderId: '…' }`. Named rather than spread
   * across the options so an unknown key stays ignored instead of silently becoming a
   * filter. `listBy(criteria)` is the same thing said as an intention.
   */
  where?: Record<string, unknown>;
}

/** Result of list() — extends Array so it's backward compatible. */
export interface ListResult<T> extends Array<T> {
  /** Total number of matching records (only set when count: true). */
  total?: number;
  /** Cursor of the last item (for cursor-based pagination). */
  endCursor?: string;
  /** Whether more records exist after endCursor. */
  hasMore?: boolean;
}

/**
 * The keys `list()` answers to. Anything else is a mistake, and saying so is the point:
 * the façade refuses an unknown key in a CLIENT's input (`Unknown field`) — this applies the
 * same rule to the framework's own arguments. `list({ orderId })` used to be accepted and
 * the filter dropped, so a one-to-many relation quietly returned the whole table.
 */
export const LIST_OPTION_KEYS = [
  'limit', 'offset', 'page', 'after', 'orderBy', 'order', 'count', 'where', 'select',
] as const;

/** Refuse an option the port does not answer to, naming it and what was expected. */
export function assertListOptions(options: object | undefined, entity: string): void {
  if (!options) return;
  const legal = new Set<string>(LIST_OPTION_KEYS);
  const strangers = Object.keys(options).filter((key) => !legal.has(key));
  if (strangers.length === 0) return;
  throw new Error(
    `${entity}.list(): unknown option ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
    `Known options are ${LIST_OPTION_KEYS.join(', ')} — to filter, pass \`where: { ${strangers[0]}: … }\`.`,
  );
}

/** Select option — restrict returned fields to those of a SchemaLike. */
export interface SelectOption {
  select?: SchemaLike;
}

/** Per-entity ORM — scoped CRUD operations on a single entity type. */
export interface EntityOrm<T = Record<string, unknown>> {
  list(options?: ListOptions & SelectOption): Promise<ListResult<T>>;
  findById(id: string, options?: SelectOption): Promise<T | undefined>;
  /**
   * Read by criteria — `findBy({ email })` for the one, `findAllBy({ orderId })` for the
   * many, which is what a one-to-many relation *is*.
   *
   * Both existed on the SQL implementation from the start and neither was declared here.
   * A port that hides what it offers is a port nobody can use: `auth-better` cast its way
   * in (`orm as OrmWithFindBy`), a presenter that needed the lines of an order read the
   * whole table instead, and the GraphQL relation resolver passed criteria to `list()`
   * — which drops what it does not know.
   */
  findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T | undefined>;
  findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T[]>;
  create(input: Partial<T>, options?: SelectOption): Promise<T>;
  update(id: string, input: Partial<T>, options?: SelectOption): Promise<T>;
  delete(id: string): Promise<boolean>;
  /** Returns a scoped ORM that restricts all read results to the fields of the given schema. */
  output(schema: SchemaLike): EntityOrm<T>;
  /**
   * What this ORM wraps — the Kysely instance for the SQL one, something else elsewhere.
   *
   * Every judge sits on the ORM's own methods, so a statement issued here meets none of
   * them: a value the entity refuses lands in the table without a word. It is the port's
   * own escape hatch rather than a handle on the side, so it keeps the scope the container
   * gave you — `productOrm.client` reaches the products, not the whole database.
   *
   * `unknown` on purpose: the client belongs to the implementation, and narrowing it is
   * the caller saying out loud which one they are standing on.
   */
  readonly client: unknown;
}

/**
 * Factory that creates an EntityOrm for a given entity.
 * Called by bootstrap for every scanned entity.
 */
export type OrmFactory = (entity: SchemaLike, name: string) => EntityOrm;
