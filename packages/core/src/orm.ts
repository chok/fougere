import type { SchemaView } from '@fougere/schema';

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

/** Select option — restrict returned fields to those of a SchemaView. */
interface SelectOption {
  select?: SchemaView;
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
  /**
   * Read a SET of rows by their key, in one go — the gesture every other one was
   * being bent into.
   *
   * `findAllBy` compares with `=`, so a list of ids could not be passed to it; the
   * only way to read N rows was `list()` then filter in memory, which is what 14 of
   * 14 handlers of a real app measured on 2026-08-14 were doing. It is invisible on
   * SQLite and it is the whole table the day the rows are not local.
   *
   * It answers a MAP, because the caller holds keys and not positions: a page zips
   * against it by `get(row.authorId)`, a miss is the absence of a key, and a repeated
   * key is one entry. The list form this replaced promised that zip and could not
   * keep it — dropping a miss shifts every later position — so each caller rebuilt
   * the very index the implementation had just thrown away.
   */
  findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, T>>;
  /**
   * Its dual: the rows that point AT each of these keys, grouped by the one they point at.
   *
   * `findByKeys` answers the side a row designates — one each, at most. This answers the
   * side that designates the row — several each, and a key with none is simply absent.
   * Together they are both directions of a relation, each in one query.
   *
   * Written because the page-shaped gesture only covered one of them: a presenter holding
   * its page and wanting "the items of these lists" had no vocabulary for it and read the
   * whole table instead, measured on a real app. `field` names the foreign key on THIS
   * entity, the one carrying the value.
   */
  findAllByKeys(field: string, keys: readonly string[], options?: SelectOption): Promise<Map<string, T[]>>;
  create(input: Partial<T>, options?: SelectOption): Promise<T>;
  /**
   * Write the row, or make the existing one look like this — one statement.
   *
   * What an import needs and the port did not have: `create` throws on the second run,
   * so re-reading a source meant deleting first. Measured pulling an API twice.
   *
   * The key and the creation stamps survive an overwrite — a row keeps the moment it
   * appeared. An engine with no upsert clause refuses by name rather than emulating
   * one with a read in front, which would promise an atomicity it has not got.
   */
  upsert(input: Partial<T>, options?: SelectOption): Promise<T>;
  /**
   * A whole page in one statement — what an import writes through.
   *
   * Row by row, 500 rows were 500 statements (measured); the shape of an import is a
   * page, so the write is one too. Answers how many rows were written rather than the
   * rows: `create` hands back the complete row because a caller acts on it, and an
   * import acts on none of them — re-reading a page for a symmetry nobody uses would
   * double the work.
   */
  upsertAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<number>;
  update(id: string, input: Partial<T>, options?: SelectOption): Promise<T>;
  delete(id: string): Promise<boolean>;
  /** Returns a scoped ORM that restricts all read results to the fields of the given schema. */
  output(schema: SchemaView): EntityOrm<T>;
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
export type OrmFactory = (entity: SchemaView, name: string) => EntityOrm;

/**
 * Container key of an entity's storage — 'reading' → 'ReadingOrm'.
 *
 * The twin of {@link repositoryKeyOf} and of `facadeKeyOf`: the key of a thing
 * lives with the thing. This one was spelled by hand in four places in
 * `bootstrap.ts` and a fifth in `scanner.ts` — where the SCAN derives what a
 * constructor asks for. Two readers of one convention, neither of them naming it,
 * so a rename would have moved one and left the other resolving to nothing.
 */
export function ormKeyOf(entity: string): string {
  return `${entity[0].toUpperCase()}${entity.slice(1)}Orm`;
}
