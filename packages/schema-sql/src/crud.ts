/**
 * SqlEntityOrm — per-entity ORM over Kysely, one implementation for every engine.
 *
 * Structurally matches @fougere/core's EntityOrm (duck typed, no dep). There is
 * no generated table object: Kysely addresses tables and columns by name, so the
 * entity stays the only description. The field↔column mapping is explicit rather
 * than a global plugin — auth tables carry their own naming and must not be
 * rewritten behind the caller's back.
 *
 * `create` and `update` re-read the row instead of using `RETURNING`: the
 * contract is to hand back the COMPLETE row, including defaults realised by SQL.
 * That also makes the code identical on MySQL and SQL Server, which have no
 * `RETURNING` clause.
 */
import type { Kysely } from 'kysely';
import { applyCreate, applyUpdate, schemaOf, type Fields, type SchemaLike, type SchemaSource } from '@fougere/schema';
import { toTable, type TableDef } from './table.js';
import { codecsOf, type ValueCodec } from './values.js';

/** ListOptions — duplicated from @fougere/core to avoid a runtime dep. */
interface ListOptions {
  limit?: number;
  offset?: number;
  page?: number;
  after?: string;
  orderBy?: string;
  order?: 'asc' | 'desc';
  count?: boolean;
}

interface ListResult<T> extends Array<T> {
  total?: number;
  endCursor?: string;
  hasMore?: boolean;
}

interface SelectOption {
  select?: SchemaLike;
}

interface PrimaryKeyInfo {
  names: string[];
  isComposite: boolean;
}

/**
 * The primary key, read off the role axis.
 *
 * Used to answer "what identifies a row" — where to point a WHERE, what a cursor
 * carries. The generated ids and managed timestamps that used to be computed here
 * moved to `applyCreate`/`applyUpdate` (`@fougere/schema`): nothing in them was about
 * SQL, and every other storage was re-deriving them from scratch.
 */
function analyzeFields(entity: SchemaLike): { pk: PrimaryKeyInfo } {
  const pkNames = Object.entries(entity.getFields())
    .filter(([, field]) => field.role?.primary)
    .map(([name]) => name);

  return { pk: { names: pkNames, isComposite: pkNames.length > 1 } };
}

/** Stand-in for "no upper bound", where the engine still demands a LIMIT. */
const UNBOUNDED = 1_000_000_000;

function pick<T extends Record<string, unknown>>(obj: T, keys: Set<string>): T {
  const result: Record<string, unknown> = {};
  for (const key of keys) if (key in obj) result[key] = obj[key];
  return result as T;
}

function pickList<T extends Record<string, unknown>>(list: ListResult<T>, keys: Set<string>): ListResult<T> {
  const result = list.map((item) => pick(item, keys)) as ListResult<T>;
  result.total = list.total;
  result.endCursor = list.endCursor;
  result.hasMore = list.hasMore;
  return result;
}

export class SqlEntityOrm {
  private table: TableDef;
  private pk: PrimaryKeyInfo;
  /** The axes `applyCreate`/`applyUpdate` read — held once, they are asked per write. */
  private fields: Fields;
  private selectFields?: Set<string>;
  /** field → column and back; the entity names travel, the SQL names stay inside. */
  private toColumn = new Map<string, string>();
  private toField = new Map<string, string>();
  /** field → the value pair a driver needs; only for the shapes a driver can't bind. */
  private codecs: Map<string, ValueCodec>;

  constructor(
    private db: Kysely<any>,
    source: SchemaSource,
    tableName: string,
    selectFields?: Set<string>,
  ) {
    // Normalized once: the table projection and the axis analysis below both read the
    // schema, and a card handed to each separately would be rebuilt twice into two
    // unrelated field objects. Past this line nothing knows which form arrived.
    const entity = schemaOf(source);
    this.table = toTable(tableName, entity);
    for (const column of this.table.columns) {
      this.toColumn.set(column.field, column.name);
      this.toField.set(column.name, column.field);
    }
    this.codecs = codecsOf(this.table.columns);
    this.pk = analyzeFields(entity).pk;
    this.fields = entity.getFields();
    this.selectFields = selectFields;
  }

  /** The Kysely instance this ORM wraps — no judge sits behind it. See EntityOrm.client. */
  get client(): Kysely<any> {
    return this.db;
  }

  /** Returns a scoped ORM that restricts all read results to the fields of the given schema. */
  output(schema: SchemaLike): SqlEntityOrm {
    const scoped = Object.create(this) as SqlEntityOrm;
    (scoped as any).selectFields = new Set(Object.keys(schema.getFields()));
    return scoped;
  }

  private resolveSelect(options?: SelectOption): Set<string> | undefined {
    if (options?.select) return new Set(Object.keys(options.select.getFields()));
    return this.selectFields;
  }

  private column(field: string): string {
    return this.toColumn.get(field) ?? field;
  }

  /** The value a driver can bind — `true` becomes 1, a Date becomes its ISO string. */
  private write(field: string, value: unknown): unknown {
    return this.codecs.get(field)?.write(value) ?? value;
  }

  /** Entity keys → column keys, and entity values → bindable values. */
  private toRow(data: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) row[this.column(key)] = this.write(key, value);
    return row;
  }

  /** Column keys → entity keys, and column values → the values the entity declares. */
  private fromRow(row: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const field = this.toField.get(key) ?? key;
      data[field] = this.codecs.get(field)?.read(value) ?? value;
    }
    return data;
  }

  /**
   * Apply a primary-key filter (simple or composite).
   *
   * The key crosses to the column exactly like every other value — `whereAll` states
   * the rule two lines below and this did not follow it. It cost nothing while every
   * generated key was a string; a key that holds a Date (`primary(auto())`) inserted
   * fine and then failed its own re-read, with the row already persisted.
   */
  private wherePk<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, id: string | Record<string, unknown>): Q {
    if (this.pk.isComposite) {
      const obj = id as Record<string, unknown>;
      return this.pk.names.reduce((q, name) => q.where(this.column(name), '=', this.write(name, obj[name])), query);
    }
    const name = this.pk.names[0];
    return query.where(this.column(name), '=', this.write(name, id));
  }

  // A filter compares against the COLUMN, so its value crosses the same way a write
  // does: `findBy({ done: true })` has to look for 1, not for `true`.
  private whereAll<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, criteria: Record<string, unknown>): Q {
    return Object.entries(criteria).reduce(
      (q, [key, value]) => q.where(this.column(key), '=', this.write(key, value)),
      query,
    );
  }

  async list(options?: ListOptions & SelectOption & { where?: Record<string, unknown> }): Promise<ListResult<Record<string, unknown>>> {
    let query = this.db.selectFrom(this.table.name).selectAll();

    // The criteria a caller states — `list({ where: { orderId } })`, and the whole of
    // `listBy`. Named `where` rather than spread across the options so an unknown key
    // stays what it always was (ignored) instead of silently becoming a filter.
    if (options?.where) query = this.whereAll(query as any, options.where) as any;

    // Cursor-based: fetch after a given id (uses the first PK field).
    if (options?.after) {
      query = query.where(this.column(this.pk.names[0]), '>', options.after);
    }
    if (options?.orderBy && this.toColumn.has(options.orderBy)) {
      query = query.orderBy(this.column(options.orderBy), options.order === 'desc' ? 'desc' : 'asc');
    }

    const limit = options?.limit;
    // Fetch one extra to determine hasMore.
    if (limit !== undefined) query = query.limit(limit + 1);

    const offset = options?.page !== undefined && limit !== undefined
      ? (options.page - 1) * limit
      : options?.offset;
    if (offset !== undefined && offset > 0) {
      // SQLite and MySQL reject OFFSET without a preceding LIMIT — an offset on
      // its own needs an upper bound that means "everything after".
      if (limit === undefined) query = query.limit(UNBOUNDED);
      query = query.offset(offset);
    }

    const rows = (await query.execute()).map((row: any) => this.fromRow(row));

    const hasMore = limit !== undefined && rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const result = data as ListResult<Record<string, unknown>>;
    result.hasMore = hasMore;

    if (data.length > 0) {
      result.endCursor = String(data[data.length - 1][this.pk.names[0]] ?? '');
    }

    // Count is opt-in — a separate query.
    if (options?.count) {
      const row = await this.db
        .selectFrom(this.table.name)
        .select((eb: any) => eb.fn.countAll().as('count'))
        .executeTakeFirst();
      result.total = Number((row as any)?.count ?? 0);
    }

    const sel = this.resolveSelect(options);
    return sel ? pickList(result, sel) : result;
  }

  async findById(id: string | Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown> | undefined> {
    const row = await this.wherePk(this.db.selectFrom(this.table.name).selectAll() as any, id).executeTakeFirst();
    if (!row) return undefined;
    const data = this.fromRow(row);
    const sel = this.resolveSelect(options);
    return sel ? pick(data, sel) : data;
  }

  async findBy(criteria: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown> | undefined> {
    const row = await this.whereAll(this.db.selectFrom(this.table.name).selectAll() as any, criteria)
      .limit(1)
      .executeTakeFirst();
    if (!row) return undefined;
    const data = this.fromRow(row);
    const sel = this.resolveSelect(options);
    return sel ? pick(data, sel) : data;
  }

  async findAllBy(criteria: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>[]> {
    const rows = await this.whereAll(this.db.selectFrom(this.table.name).selectAll() as any, criteria).execute();
    const data = rows.map((row: any) => this.fromRow(row));
    const sel = this.resolveSelect(options);
    return sel ? data.map((r: any) => pick(r, sel)) : data;
  }

  async create(input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    // The lifecycle axis, realized where it is declared — a generated id, a stamped
    // `createdAt`, a declared default. The column DEFAULT below still holds for a
    // writer that is not us, the way a CHECK does; nothing depends on it any more.
    const data = applyCreate(this.fields, input);

    await this.db.insertInto(this.table.name).values(this.toRow(data)).execute();

    // Contract: create returns the COMPLETE row (validation judges absence, it
    // never fills) — re-read so SQL-realised defaults appear. Same move as update().
    const id = this.pk.isComposite
      ? Object.fromEntries(this.pk.names.map((n) => [n, data[n]]))
      : (data[this.pk.names[0]] as string | undefined);
    const created = id !== undefined ? await this.findById(id) : undefined;
    const result = created ?? data;
    const sel = this.resolveSelect(options);
    return sel ? pick(result, sel) : result;
  }

  async update(id: string | Record<string, unknown>, input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    const data = applyUpdate(this.fields, input);

    await this.wherePk(this.db.updateTable(this.table.name).set(this.toRow(data)) as any, id).execute();

    const updated = await this.findById(id);
    const result = updated ?? (typeof id === 'string' ? { id, ...data } : { ...id, ...data });
    const sel = this.resolveSelect(options);
    return sel ? pick(result, sel) : result;
  }

  async delete(id: string | Record<string, unknown>): Promise<boolean> {
    const before = await this.findById(id);
    if (!before) return false;
    await this.wherePk(this.db.deleteFrom(this.table.name) as any, id).execute();
    return true;
  }
}

/** camelCase → snake_case + plural ('orderLine' → 'order_lines') */
function defaultTableName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) + 's';
}

export interface OrmFactoryOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
}

/**
 * Create an OrmFactory backed by Kysely — same call shape on every engine.
 *
 * ```ts
 * const app = await createApp({ createContainer, ormFactory: createOrmFactory(db) });
 * ```
 */
export function createOrmFactory(db: Kysely<any>, options?: OrmFactoryOptions) {
  const resolve = options?.tableName ?? defaultTableName;
  return (entity: SchemaSource, name: string) => new SqlEntityOrm(db, entity, resolve(name));
}
