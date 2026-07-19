/**
 * DrizzleEntityOrm — auto-generated per-entity ORM backed by Drizzle SQLite.
 *
 * Structurally matches @fougere/core EntityOrm interface (duck typed, no dep).
 */
import { eq, gt, and, asc, desc, sql } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { resolveCustomGenerator, type Field, type GeneratorRef, type SchemaLike } from '@fougere/schema';
import { createId } from '@paralleldrive/cuid2';
import { toSqliteTable } from './sqlite.js';

/** ListOptions — duplicated from @fougere/core to avoid runtime dep. */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = {
  select(fields?: any): any;
  insert(table: any): any;
  update(table: any): any;
  delete(table: any): any;
};

/** Primary key info for an entity. */
interface PrimaryKeyInfo {
  /** Field names that are part of the primary key. */
  names: string[];
  /** Generator for auto-generated IDs (only for 'id' type fields). */
  generators: Map<string, () => string>;
  /** Whether the PK is composite (more than one field). */
  isComposite: boolean;
}

/**
 * Resolve a generator TOKEN to a concrete function: a custom name registered via
 * `registerGenerator` wins, then the built-in presets (this package owns their
 * dependencies). An unknown name throws — loud and local, instead of a silent
 * closure lost through describe/reconstruct.
 */
function resolveGenerator(gen: GeneratorRef): () => string {
  const custom = resolveCustomGenerator(gen);
  if (custom) return custom;
  switch (gen) {
    case 'cuid2': return createId;
    case 'uuid': return () => globalThis.crypto.randomUUID();
    case 'nanoid': {
      // Lazy nanoid — lightweight inline implementation (21 chars, URL-safe)
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

/** Collect primary key info and auto-fill fields from entity. */
function analyzeFields(entity: SchemaLike): { pk: PrimaryKeyInfo; autos: string[]; updateNow: string[] } {
  const fields = entity.getFields();
  const pkNames: string[] = [];
  const generators = new Map<string, () => string>();
  const autos: string[] = [];
  const updateNow: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    if (field.role?.primary) pkNames.push(name);
    // lifecycle.create {generate} → auto-generated id; 'now' → managed timestamp
    const create = field.lifecycle?.create;
    if (typeof create === 'object' && 'generate' in create) {
      generators.set(name, resolveGenerator(create.generate));
    } else if (create === 'now') {
      autos.push(name);
    }
    // lifecycle.update 'now' → stamped at every update (the canonical updatedAt)
    if (field.lifecycle?.update === 'now') updateNow.push(name);
  }

  return {
    pk: { names: pkNames, generators, isComposite: pkNames.length > 1 },
    autos,
    updateNow,
  };
}

/** Pick only allowed keys from an object. */
function pick<T extends Record<string, unknown>>(obj: T, keys: Set<string>): T {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result as T;
}

/** Pick from each item in a ListResult, preserving pagination metadata. */
function pickList<T extends Record<string, unknown>>(list: ListResult<T>, keys: Set<string>): ListResult<T> {
  const result = list.map((item) => pick(item, keys)) as ListResult<T>;
  result.total = list.total;
  result.endCursor = list.endCursor;
  result.hasMore = list.hasMore;
  return result;
}

/** Build a WHERE condition for a primary key (simple or composite). */
function pkWhere(table: any, pk: PrimaryKeyInfo, id: string | Record<string, unknown>) {
  if (pk.isComposite) {
    const obj = id as Record<string, unknown>;
    const conditions = pk.names.map((name) => eq(table[name], obj[name]));
    return and(...conditions);
  }
  return eq(table[pk.names[0]], id as string);
}

export class DrizzleEntityOrm {
  private table: SQLiteTableWithColumns<any>;
  private pk: PrimaryKeyInfo;
  private autos: string[];
  private updateNow: string[];
  private selectFields?: Set<string>;

  constructor(
    private db: DrizzleDb,
    entity: SchemaLike,
    tableName: string,
    selectFields?: Set<string>,
  ) {
    this.table = toSqliteTable(tableName, entity as any);
    const { pk, autos, updateNow } = analyzeFields(entity);
    this.pk = pk;
    this.autos = autos;
    this.updateNow = updateNow;
    this.selectFields = selectFields;
  }

  /** Returns a scoped ORM that restricts all read results to the fields of the given schema. */
  output(schema: SchemaLike): DrizzleEntityOrm {
    const fields = new Set(Object.keys(schema.getFields()));
    const scoped = Object.create(this) as DrizzleEntityOrm;
    scoped.selectFields = fields;
    return scoped;
  }

  /** Resolve effective select fields from instance scope + per-call option. */
  private resolveSelect(options?: SelectOption): Set<string> | undefined {
    if (options?.select) return new Set(Object.keys(options.select.getFields()));
    return this.selectFields;
  }

  async list(options?: ListOptions & SelectOption): Promise<ListResult<Record<string, unknown>>> {
    let query = this.db.select().from(this.table);

    // Cursor-based: fetch after a given ID (uses first PK field)
    if (options?.after) {
      const cursorCol = (this.table as any)[this.pk.names[0]];
      query = query.where(gt(cursorCol, options.after));
    }

    // Sorting
    if (options?.orderBy && (this.table as any)[options.orderBy]) {
      const col = (this.table as any)[options.orderBy];
      query = query.orderBy(options.order === 'desc' ? desc(col) : asc(col));
    }

    // Offset — from page or direct offset
    const limit = options?.limit;
    if (limit !== undefined) {
      // Fetch one extra to determine hasMore
      query = query.limit(limit + 1);
    }

    const offset = options?.page !== undefined && limit !== undefined
      ? (options.page - 1) * limit
      : options?.offset;

    if (offset !== undefined && offset > 0) {
      query = query.offset(offset);
    }

    const rows: Record<string, unknown>[] = await query;

    // Build result
    const hasMore = limit !== undefined && rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const result = data as ListResult<Record<string, unknown>>;
    result.hasMore = hasMore;

    if (data.length > 0) {
      const lastRow = data[data.length - 1] as any;
      result.endCursor = String(lastRow[this.pk.names[0]] ?? '');
    }

    // Count (opt-in, separate query)
    if (options?.count) {
      const [{ count: total }] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.table);
      result.total = total;
    }

    const sel = this.resolveSelect(options);
    return sel ? pickList(result, sel) : result;
  }

  /** Find by primary key (string for single PK, object for composite). */
  async findById(id: string | Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown> | undefined> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(pkWhere(this.table, this.pk, id));
    const row = rows[0];
    if (!row) return undefined;
    const sel = this.resolveSelect(options);
    return sel ? pick(row, sel) : row;
  }

  /** Find first row matching criteria. */
  async findBy(criteria: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown> | undefined> {
    const conditions = Object.entries(criteria).map(
      ([key, value]) => eq((this.table as any)[key], value),
    );
    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    const sel = this.resolveSelect(options);
    return sel ? pick(row, sel) : row;
  }

  /** Find all rows matching criteria. */
  async findAllBy(criteria: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>[]> {
    const conditions = Object.entries(criteria).map(
      ([key, value]) => eq((this.table as any)[key], value),
    );
    const rows: Record<string, unknown>[] = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions));
    const sel = this.resolveSelect(options);
    return sel ? rows.map((r) => pick(r, sel)) : rows;
  }

  async create(input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { ...input };
    // Auto-fill primary keys using configured generator
    for (const [name, gen] of this.pk.generators) {
      if (!(name in data)) data[name] = gen();
    }
    // Auto-fill auto fields (timestamps)
    for (const key of this.autos) {
      if (!(key in data)) data[key] = new Date().toISOString();
    }
    await this.db.insert(this.table).values(data);
    // Contract: create returns the COMPLETE row (validation judges absence,
    // it never fills) — re-fetch so the rules realised by SQL, the `{ value }
    // DEFAULT`s, appear in the result. Same move as update().
    const id = this.pk.isComposite
      ? Object.fromEntries(this.pk.names.map((n) => [n, data[n]]))
      : (data[this.pk.names[0]] as string | undefined);
    const created = id !== undefined ? await this.findById(id) : undefined;
    const result = created ?? data;
    const sel = this.resolveSelect(options);
    return sel ? pick(result, sel) : result;
  }

  /** Update by primary key (string for single PK, object for composite). */
  async update(id: string | Record<string, unknown>, input: Record<string, unknown>, options?: SelectOption): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { ...input };
    // Realise `update: 'now'` — stamped at every update when absent (a supplied
    // value is accepted, same rule as create).
    for (const key of this.updateNow) {
      if (!(key in data)) data[key] = new Date().toISOString();
    }
    await this.db
      .update(this.table)
      .set(data)
      .where(pkWhere(this.table, this.pk, id));
    const updated = await this.findById(id);
    const result = updated ?? (typeof id === 'string' ? { id, ...data } : { ...id, ...data });
    const sel = this.resolveSelect(options);
    return sel ? pick(result, sel) : result;
  }

  /** Delete by primary key (string for single PK, object for composite). */
  async delete(id: string | Record<string, unknown>): Promise<boolean> {
    const before = await this.findById(id);
    if (!before) return false;
    await this.db
      .delete(this.table)
      .where(pkWhere(this.table, this.pk, id));
    return true;
  }
}

/** camelCase → snake_case + plural ('orderLine' → 'order_lines') */
function toTableName(name: string): string {
  const snake = name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return snake + 's';
}

export interface OrmFactoryOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
}

/**
 * Create an OrmFactory backed by Drizzle SQLite.
 *
 * Usage:
 * ```ts
 * const app = await createApp({
 *   createContainer,
 *   ormFactory: createOrmFactory(db),
 * });
 * ```
 */
export function createOrmFactory(db: DrizzleDb, options?: OrmFactoryOptions) {
  const resolve = options?.tableName ?? toTableName;
  return (entity: SchemaLike, name: string) => new DrizzleEntityOrm(db, entity, resolve(name));
}
