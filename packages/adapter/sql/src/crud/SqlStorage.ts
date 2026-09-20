import { Role } from '@fougere/schema';
import { sql, type Kysely } from 'kysely';
import { applyCreate, applyUpdate, type Fields, type SchemaView } from '@fougere/schema';
import { toTable, toTableName, type TableDef } from '../table/TableDef.js';
import { resolveDialect, type Dialect } from '../dialect/Dialect.js';
import { type DialectName } from '../dialect/DialectName.js';
import { comparisonOf, comparisonsIn, ErrorCode, FougereError, type Comparison } from '@fougere/core/contract';
import { codecsOf, type ValueCodec } from '../values.js';
import type { StorageFactoryOptions } from './StorageFactoryOptions.js';

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
  select?: SchemaView;
}

interface PrimaryKeyInfo {
  names: string[];
  isComposite: boolean;
}

/** The primary key, read off the role axis. */
function analyzeFields(entity: SchemaView): { pk: PrimaryKeyInfo } {
  const pkNames = Object.entries(entity.getFields())
    .filter(([, field]) => Role.of(field).isPrimary())
    .map(([name]) => name);

  return { pk: { names: pkNames, isComposite: pkNames.length > 1 } };
}

/** Slice a key set into what one statement may bind. One slice when it already fits. */
function chunks<T>(values: T[], size: number): T[][] {
  if (values.length <= size) return [values];
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));

  return out;
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

export class SqlStorage {
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

  /** Kept whole: the engine answers more than one question, and refusals are one of them. */
  private dialect: Dialect;
  /** How many keys one statement may carry here — see `Dialect.maxBindings`. */
  private maxBindings: number;
  /** How this engine spells an upsert, or `false` when it cannot — see `Dialect.upsert`. */
  private upsertClause: 'on conflict' | 'on duplicate key' | false;

  constructor(
    private db: Kysely<any>,
    entity: SchemaView,
    tableName: string,
    selectFields?: Set<string>,
    dialect: DialectName = 'sqlite',
  ) {
    const resolved = resolveDialect(dialect);
    this.dialect = resolved;
    this.maxBindings = resolved.maxBindings;
    this.upsertClause = resolved.upsert;
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

  /** The Kysely instance this storage wraps — no validator sits behind it. See Storage.client. */
  get client(): Kysely<any> {
    return this.db;
  }

  /** Returns a scoped storage that restricts all read results to the fields of the given schema. */
  output(schema: SchemaView): SqlStorage {
    const scoped = Object.create(this) as SqlStorage;
    scoped.selectFields = new Set(Object.keys(schema.getFields()));

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

  /** Apply a primary-key filter (simple or composite). */
  private wherePk<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, id: string | Record<string, unknown>): Q {
    if (this.pk.isComposite) {
      const composite = id as Record<string, unknown>;

      return this.pk.names.reduce((q, name) => q.where(this.column(name), '=', this.write(name, composite[name])), query);
    }
    const name = this.pk.names[0];

    return query.where(this.column(name), '=', this.write(name, id));
  }

  // A filter compares against the COLUMN, so its value crosses the same way a write
  // does: `findBy({ done: true })` has to look for 1, not for `true`.
  //
  // A criterion may name a SET — `where: { id: [a, b, c] }` is `IN`, one query for a
  // whole page. Without it a relation had no batch form at all: the GraphQL `one`
  // resolver read row by row (50 calls for a page of 50, measured), while its `many`
  // dual already went through this same facade. An empty set matches nothing, said in
  // SQL rather than by returning the whole table.
  private whereAll<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, criteria: Record<string, unknown>): Q {
    return Object.entries(criteria).reduce((q, [key, value]) => {
      const comparison = comparisonOf(this.fields[key], value);
      if (comparison) return this.compared(q, key, comparison);

      return Array.isArray(value)
        ? q.where(this.column(key), 'in', [...new Set(value)].map((v) => this.write(key, v)))
        : q.where(this.column(key), '=', this.write(key, value));
    }, query);
  }

  /**
   * What a bare value and a set could not say. Every comparison a criterion names is
   * AND-ed, which is the rule two criteria already follow — `{ gte: 100, lte: 400 }` is
   * one range, not two answers.
   */
  private compared<Q extends { where(a: any, b: any, c: any): Q }>(
    query: Q,
    key: string,
    comparison: Comparison,
  ): Q {
    const column = this.column(key);
    const bound = (value: unknown) => this.write(key, value);

    return comparisonsIn(comparison).reduce((q, [name, value]) => {
      switch (name) {
        case 'gte': return q.where(column, '>=', bound(value));
        case 'lte': return q.where(column, '<=', bound(value));
        case 'gt': return q.where(column, '>', bound(value));
        case 'lt': return q.where(column, '<', bound(value));
        case 'ne': return q.where(column, '!=', bound(value));
        case 'contains': return q.where(column, 'like', `%${String(value)}%`);
        case 'notIn': {
          const values = [...new Set(value as readonly unknown[])].map(bound);

          return values.length ? q.where(column, 'not in', values) : q;
        }
        case 'isNull': return q.where(column, value ? 'is' : 'is not', null);
        case 'between': {
          const [low, high] = value as [unknown, unknown];

          return q.where(column, '>=', bound(low)).where(column, '<=', bound(high));
        }
      }
    }, query);
  }

  async list(options?: ListOptions & SelectOption & { where?: Record<string, unknown> }): Promise<ListResult<Record<string, unknown>>> {
    const rows = (await this.pageQuery(options).execute()).map((row: any) => this.fromRow(row));
    const result = this.paged(rows, options?.limit);

    if (options?.count) result.total = await this.matching(options.where);

    const sel = this.resolveSelect(options);

    return sel ? pickList(result, sel) : result;
  }

  /** The filter, the cursor, the order and the page — one query, built in that order. */
  private pageQuery(options?: ListOptions & { where?: Record<string, unknown> }) {
    let query = this.db.selectFrom(this.table.name).selectAll();

    // The criteria a caller states — `list({ where: { orderId } })`, and the whole of
    // `listBy`. Named `where` rather than spread across the options so an unknown key
    // stays what it always was (ignored) instead of silently becoming a filter.
    if (options?.where) {
      // `list` is the ONE read that cannot be split: a limit and an order do not
      // recompose across slices, so an oversized set here is refused rather than
      // truncated — and the gesture that does handle it is named.
      this.refuseOversized(options.where, 'list');
      query = this.whereAll(query as any, options.where) as any;
    }

    if (options?.after) query = query.where(this.column(this.pk.names[0]), '>', options.after);
    if (options?.orderBy) {
      query = query.orderBy(this.column(options.orderBy), options.order === 'desc' ? 'desc' : 'asc');
    }

    const limit = options?.limit;
    // One extra row, which is how `hasMore` is answered without a second query.
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

    return query;
  }

  /** The extra row fetched above, turned into `hasMore` and the cursor the next page starts at. */
  private paged(rows: Record<string, unknown>[], limit?: number): ListResult<Record<string, unknown>> {
    const hasMore = limit !== undefined && rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const result = data as ListResult<Record<string, unknown>>;
    result.hasMore = hasMore;

    if (data.length > 0) result.endCursor = String(data[data.length - 1]![this.pk.names[0]] ?? '');

    return result;
  }

  /**
   * What the query matches, over the same FILTER and never the page.
   *
   * It used to count the whole table: `list({ where: { authorId }, count: true })` returned this
   * author's page beside everybody's total, so a paginator computed the wrong number of pages and
   * a tenant learned how many rows the other tenants have.
   */
  private async matching(where?: Record<string, unknown>): Promise<number> {
    let counting = this.db.selectFrom(this.table.name).select((eb: any) => eb.fn.countAll().as('count'));
    if (where) counting = this.whereAll(counting as any, where) as any;
    const row = await counting.executeTakeFirst();

    return Number((row as any)?.count ?? 0);
  }

  /**
   * One query for N keys, never N queries — what every page-level read stands on: a computed
   * field, a relation, a resolver on the other side of a wire.
   */
  async findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, Record<string, unknown>>> {
    if (this.pk.isComposite) {
      throw new Error(`${this.table.name}.findByKeys: the primary key is composite (${this.pk.names.join(', ')}) — read them one by one, or filter with \`findAllBy\`.`);
    }
    if (ids.length === 0) return new Map();
    const name = this.pk.names[0]!;
    const sel = this.resolveSelect(options);
    const found = new Map<string, Record<string, unknown>>();
    // Split, because a key set comes from a page and a page has no ceiling. One
    // statement per slice, merged here — the caller never learns there were several.
    for (const slice of chunks([...new Set(ids)], this.maxBindings)) {
      const rows = await this.db
        .selectFrom(this.table.name)
        .selectAll()
        .where(this.column(name), 'in', slice.map((id) => this.write(name, id)))
        .execute();
      for (const row of rows as any[]) {
        const data = this.fromRow(row);
        found.set(String(data[name]), sel ? pick(data, sel) : data);
      }
    }

    return found;
  }

  /** The other direction of a relation, in one query — see the port's `findAllByKeys`. */
  async findAllByKeys(
    field: string,
    keys: readonly string[],
    options?: SelectOption,
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const grouped = new Map<string, Record<string, unknown>[]>();
    if (keys.length === 0) return grouped;
    const rows = await this.findAllBy({ [field]: [...keys] }, options);
    for (const row of rows) {
      const key = String(row[field]);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(row); else grouped.set(key, [row]);
    }

    return grouped;
  }

  /** Write the row, or make the existing one look like this — one statement. */
  async upsert(input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    if (this.upsertClause === false) {
      throw new Error(
        `${this.table.name}.upsert(): this engine has no upsert clause — read with findById ` +
        `and call create or update, and know that the pair is not atomic.`,
      );
    }
    // `applyUpdate` FIRST: `updated()` declares both `create: 'now'` and
    // `update: 'now'`, so filling the creation side first leaves nothing for the
    // update side to stamp — the row would carry the moment it was inserted forever.
    const data = applyCreate(this.fields, applyUpdate(this.fields, input));
    const replaced = this.toRow(applyUpdate(this.fields, input));

    await this.onExisting(this.db.insertInto(this.table.name).values(this.toRow(data)), replaced).execute();

    const id = this.pk.isComposite
      ? Object.fromEntries(this.pk.names.map((n) => [n, data[n]]))
      : (data[this.pk.names[0]!] as string);

    return (await this.findById(id as never, options))!;
  }

  /** Upsert a whole page in one statement — what an import writes through. */
  async upsertAll(inputs: readonly Record<string, unknown>[], _options?: SelectOption): Promise<number> {
    if (this.upsertClause === false) {
      throw new Error(
        `${this.table.name}.upsertAll(): this engine has no upsert clause — write the rows ` +
        `one by one with create or update, and know that the pair is not atomic.`,
      );
    }
    if (inputs.length === 0) return 0;

    // One statement replaces the same columns on every row it holds, so rows that name
    // different fields go in different statements — or one row's gap erases another's value.
    const pages = new Map<string, { replaced: string[]; rows: Record<string, unknown>[] }>();
    for (const input of inputs) {
      const replaced = Object.keys(this.toRow(applyUpdate(this.fields, input))).sort();
      const page = pages.get(replaced.join()) ?? pages.set(replaced.join(), { replaced, rows: [] }).get(replaced.join())!;
      page.rows.push(this.toRow(applyCreate(this.fields, applyUpdate(this.fields, input))));
    }

    let written = 0;
    for (const { replaced, rows } of pages.values()) {
      const incoming = Object.fromEntries(replaced.map((column) => [column, this.incoming(column)]));
      // A statement binds VALUES: one row costs as many as it has columns.
      const width = new Set(rows.flatMap((row) => Object.keys(row))).size;
      const perStatement = Math.max(1, Math.floor(this.maxBindings / Math.max(1, width)));

      for (const slice of chunks(rows, perStatement)) {
        await this.onExisting(this.db.insertInto(this.table.name).values(slice), incoming).execute();
        written += slice.length;
      }
    }

    return written;
  }

  /** The value a refused row brought for a column: `excluded` on SQLite and Postgres, `VALUES()` on MySQL. */
  private incoming(column: string) {
    return this.upsertClause === 'on conflict' ? sql.ref(`excluded.${column}`) : sql`values(${sql.ref(column)})`;
  }

  /** What a row that is already there becomes — and nothing, when the write replaces no column. */
  private onExisting(insert: any, replaced: Record<string, unknown>) {
    const keys = this.pk.names.map((n) => this.column(n));
    const empty = Object.keys(replaced).length === 0;

    if (this.upsertClause === 'on conflict') {
      return insert.onConflict((oc: any) => (empty ? oc.columns(keys).doNothing() : oc.columns(keys).doUpdateSet(replaced)));
    }

    return insert.onDuplicateKeyUpdate(empty ? { [keys[0]!]: sql.ref(keys[0]!) } : replaced);
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
    const sel = this.resolveSelect(options);
    const out: Record<string, unknown>[] = [];
    // A set criterion may hold more values than the engine binds. Splitting is safe
    // HERE because this read has no page and no order: the slices simply concatenate.
    for (const slice of this.splitCriteria(criteria)) {
      const rows = await this.whereAll(this.db.selectFrom(this.table.name).selectAll() as any, slice).execute();
      for (const row of rows as any[]) {
        const data = this.fromRow(row);
        out.push(sel ? pick(data, sel) : data);
      }
    }

    return out;
  }

  /** One criteria object per statement — the oversized set is the one that splits. */
  private refuseOversized(criteria: Record<string, unknown>, op: string): void {
    for (const [key, value] of Object.entries(criteria)) {
      if (!Array.isArray(value) || new Set(value).size <= this.maxBindings) continue;
      throw new Error(
        `${this.table.name}.${op}(): \`${key}\` holds ${new Set(value).size} values and this engine ` +
        `binds ${this.maxBindings} — a page and an order cannot be split across statements. ` +
        `Use \`findAllByKeys('${key}', keys)\`, which reads them in slices and groups the answer.`,
      );
    }
  }

  private splitCriteria(criteria: Record<string, unknown>): Record<string, unknown>[] {
    const oversized = Object.entries(criteria)
      .filter(([, value]) => Array.isArray(value) && new Set(value).size > this.maxBindings);
    if (oversized.length === 0) return [criteria];
    if (oversized.length > 1) {
      throw new Error(
        `${this.table.name}: ${oversized.map(([key]) => `\`${key}\``).join(' and ')} each hold more than ` +
        `${this.maxBindings} values — split one of them at the call site, they cannot both be sliced.`,
      );
    }
    const [key, values] = oversized[0]!;

    return chunks([...new Set(values as unknown[])], this.maxBindings)
      .map((slice) => ({ ...criteria, [key]: slice }));
  }

  async create(input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    // The lifecycle axis, realized where it is declared — a generated id, a stamped
    // `createdAt`, a declared default. The column DEFAULT below still holds for a
    // writer that is not us, the way a CHECK does; nothing depends on it any more.
    const data = applyCreate(this.fields, input);

    await this.refusal(() => this.db.insertInto(this.table.name).values(this.toRow(data)).execute());

    // Contract: create returns the COMPLETE row (validation validates absence, it
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

    await this.refusal(() => this.wherePk(this.db.updateTable(this.table.name).set(this.toRow(data)) as any, id).execute());

    const updated = await this.findById(id);
    const result = updated ?? (typeof id === 'string' ? { id, ...data } : { ...id, ...data });
    const sel = this.resolveSelect(options);

    return sel ? pick(result, sel) : result;
  }

  /**
   * A duplicate is an ANSWER, not a failure — so it leaves as `CONFLICT` and not as the blank
   * `Internal error` a caller used to get.
   */
  private async refusal<R>(write: () => Promise<R>): Promise<R> {
    try {
      return await write();
    } catch (cause) {
      if (!this.dialect.isUniqueViolation(cause)) throw cause;
      throw new FougereError({
        code: ErrorCode.CONFLICT,
        message: `A row with these values already exists in ${this.table.name}.`,
        cause,
      });
    }
  }

  async delete(id: string | Record<string, unknown>): Promise<boolean> {
    const before = await this.findById(id);
    if (!before) return false;
    await this.wherePk(this.db.deleteFrom(this.table.name) as any, id).execute();

    return true;
  }
}

/** Create a StorageFactory backed by Kysely — same call shape on every engine. */
export function createStorageFactory(db: Kysely<any>, options?: StorageFactoryOptions, dialect: DialectName = 'sqlite') {
  const resolve = options?.tableName ?? toTableName;

  return (entity: SchemaView, name: string) => new SqlStorage(db, entity, resolve(name), undefined, dialect);
}
