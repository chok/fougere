import { classNameOf, type SchemaView } from '@fougere/schema';

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
const LIST_OPTION_KEYS = [
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
  return `${classNameOf(entity)}Orm`;
}

/**
 * `Together<[Account, Ledger]>` — writes that stand or fall as one.
 *
 * `EntityOrm` is the port whose every gesture is ONE statement, and one statement is
 * atomic in every engine. This is the port whose unit is a BLOCK: what the callback did
 * happens entirely, or not at all. Nothing else separates them — the arity of the unit
 * of work is the whole distinction, which is why this lives here and not in a file of
 * its own.
 *
 * ```ts
 * constructor(private together: Together<[Account, Ledger]>) {}
 *
 * await this.together.run(async ([accounts, ledger]) => {
 *   await accounts.update(from, { balance: b - amount });
 *   await ledger.create({ from, to, amount });
 * });
 * ```
 *
 * **The second list is providers**, rebuilt inside the frame so that what THEY write is
 * covered too — a `Mirror` writes its pages through `EntityOrm<T>`, so naming it puts
 * them under the same unwind, with no locator and no second injection path:
 *
 * ```ts
 * constructor(private together: Together<[RateCard, Ledger], [RateMirror]>) {}
 *
 * await this.together.run(async ([rates, ledger], [mirror]) => { await mirror.refresh(); });
 * ```
 *
 * Two lists rather than one, because in a signature an entity and a provider are both
 * written as a class name and their instance types do not separate them — the type would
 * have to guess, by looking for methods or for a brand, and both answers are worse than
 * saying it. They are two different facts anyway: what the unwind covers, and what is
 * rebuilt to make that true.
 *
 * **All or nothing is the promise; isolation is not.** On one engine the members are
 * rebuilt over a transaction and the engine gives both. Across engines a transaction
 * cannot exist, so the frame keeps the before-image of each write and replays the
 * inverse in reverse order — the unwind holds, the isolation does not, and a reader
 * between two writes sees the half. The boot says which of the two it built rather
 * than letting the author assume the stronger one.
 */
export interface Together<E extends readonly unknown[], P extends readonly unknown[] = []> {
  run<R>(fn: (entities: { [K in keyof E]: EntityOrm<E[K]> }, providers: P) => Promise<R>): Promise<R>;
}

/**
 * The container key of a frame — `[['Account', 'Ledger'], ['RateMirror']]` →
 * 'Account+Ledger|RateMirrorTogether'.
 *
 * The DECLARED order, not a sorted one. The tuples are what the callback destructures, so
 * reordering here would hand `[ledger, accounts]` to a signature that says the opposite —
 * the type and the runtime disagreeing about the same line. Two orders of one frame are
 * therefore two keys and two registrations; they cost nothing, a frame holding no state
 * between runs.
 */
export function togetherKeyOf(entities: readonly string[], providers: readonly string[] = []): string {
  const named = entities.map(classNameOf).join(SEPARATOR);
  return `${named}${providers.length ? KINDS + providers.map(classNameOf).join(SEPARATOR) : ''}${FRAME}`;
}

const FRAME = 'Together';
const SEPARATOR = '+';
/** Separates the two lists — what the unwind covers, and what is rebuilt to make it true. */
const KINDS = '|';

/**
 * The members behind a frame key, or `undefined` when the key is not one.
 *
 * The dual of the line above, and here for the reason `factOfEmitKey` is: the boot reads
 * the key back out of a handler's `deps` to know which frames to build. A key and the way
 * to undo it belong together — the pair that is split is the pair that drifts.
 */
export function membersOfTogetherKey(key: string): { entities: string[]; providers: string[] } | undefined {
  if (key.length <= FRAME.length || !key.endsWith(FRAME)) return undefined;
  const [entities, providers = ''] = key.slice(0, -FRAME.length).split(KINDS);
  const split = (list: string) => list.split(SEPARATOR).filter(Boolean);
  return { entities: split(entities!), providers: split(providers) };
}
