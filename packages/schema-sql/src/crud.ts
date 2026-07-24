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
import { resolveCustomGenerator, type GeneratorRef, type SchemaLike } from '@fougere/schema';
import { createId } from '@paralleldrive/cuid2';
import { toTable, type TableDef } from './table.js';

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
  generators: Map<string, () => string>;
  isComposite: boolean;
}

/**
 * Resolve a generator TOKEN to a function: a custom name registered via
 * `registerGenerator` wins, then the built-in presets. An unknown name throws —
 * loud and local, instead of a silent closure lost through describe/reconstruct.
 */
function resolveGenerator(gen: GeneratorRef): () => string {
  const custom = resolveCustomGenerator(gen);
  if (custom) return custom;
  switch (gen) {
    case 'cuid2': return createId;
    case 'uuid': return () => globalThis.crypto.randomUUID();
    case 'nanoid': {
      return () => {
        const bytes = new Uint8Array(21);
        globalThis.crypto.getRandomValues(bytes);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        return Array.from(bytes, (b) => alphabet[b & 63]).join('');
      };
    }
    default:
      throw new Error(`Unknown generator '${gen}' — register it with registerGenerator('${gen}', fn)`);
  }
}

/** Primary key, generated ids and managed timestamps, read off the axes. */
function analyzeFields(entity: SchemaLike): { pk: PrimaryKeyInfo; autos: string[]; updateNow: string[] } {
  const pkNames: string[] = [];
  const generators = new Map<string, () => string>();
  const autos: string[] = [];
  const updateNow: string[] = [];

  for (const [name, field] of Object.entries(entity.getFields())) {
    if (field.role?.primary) pkNames.push(name);
    const create = field.lifecycle?.create;
    if (typeof create === 'object' && create !== null && 'generate' in create) {
      generators.set(name, resolveGenerator(create.generate));
    } else if (create === 'now') {
      autos.push(name);
    }
    if (field.lifecycle?.update === 'now') updateNow.push(name);
  }

  return { pk: { names: pkNames, generators, isComposite: pkNames.length > 1 }, autos, updateNow };
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
  private autos: string[];
  private updateNow: string[];
  private selectFields?: Set<string>;
  /** field → column and back; the entity names travel, the SQL names stay inside. */
  private toColumn = new Map<string, string>();
  private toField = new Map<string, string>();

  constructor(
    private db: Kysely<any>,
    entity: SchemaLike,
    tableName: string,
    selectFields?: Set<string>,
  ) {
    this.table = toTable(tableName, entity);
    for (const column of this.table.columns) {
      this.toColumn.set(column.field, column.name);
      this.toField.set(column.name, column.field);
    }
    const { pk, autos, updateNow } = analyzeFields(entity);
    this.pk = pk;
    this.autos = autos;
    this.updateNow = updateNow;
    this.selectFields = selectFields;
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

  /** Entity keys → column keys, for writes. */
  private toRow(data: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) row[this.column(key)] = value;
    return row;
  }

  /** Column keys → entity keys, for reads. */
  private fromRow(row: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) data[this.toField.get(key) ?? key] = value;
    return data;
  }

  /** Apply a primary-key filter (simple or composite). */
  private wherePk<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, id: string | Record<string, unknown>): Q {
    if (this.pk.isComposite) {
      const obj = id as Record<string, unknown>;
      return this.pk.names.reduce((q, name) => q.where(this.column(name), '=', obj[name]), query);
    }
    return query.where(this.column(this.pk.names[0]), '=', id as string);
  }

  private whereAll<Q extends { where(a: any, b: any, c: any): Q }>(query: Q, criteria: Record<string, unknown>): Q {
    return Object.entries(criteria).reduce((q, [key, value]) => q.where(this.column(key), '=', value), query);
  }

  async list(options?: ListOptions & SelectOption): Promise<ListResult<Record<string, unknown>>> {
    let query = this.db.selectFrom(this.table.name).selectAll();

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
    const data: Record<string, unknown> = { ...input };
    for (const [name, gen] of this.pk.generators) {
      if (!(name in data)) data[name] = gen();
    }
    for (const key of this.autos) {
      if (!(key in data)) data[key] = new Date().toISOString();
    }

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
    const data: Record<string, unknown> = { ...input };
    // Realise `update: 'now'` — stamped at every update when absent (a supplied
    // value is accepted, same rule as create).
    for (const key of this.updateNow) {
      if (!(key in data)) data[key] = new Date().toISOString();
    }

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
  return (entity: SchemaLike, name: string) => new SqlEntityOrm(db, entity, resolve(name));
}
