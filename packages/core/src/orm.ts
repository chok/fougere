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
