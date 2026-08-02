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
}

/**
 * Factory that creates an EntityOrm for a given entity.
 * Called by bootstrap for every scanned entity.
 */
export type OrmFactory = (entity: SchemaLike, name: string) => EntityOrm;
