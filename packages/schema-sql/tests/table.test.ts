import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, oneOf, ref, optional, many, json } from '@fougere/schema';
import { toTable, isKeyed, dialects, type ColumnDef } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────────

class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
  products: many(() => Product),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1, max: 255 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  note: optional(text()),
  createdAt: auto(),
}) {}

class Shipment extends entity({
  shipped: bool(),
  carrier: text(),
}) {}

class Order extends entity({
  id: primary(),
  status: oneOf('draft', 'pending', 'paid'),
  meta: json(Shipment),
}) {}

const column = (table: { columns: ColumnDef[] }, field: string): ColumnDef => {
  const found = table.columns.find((c) => c.field === field);
  if (!found) throw new Error(`no column for '${field}'`);
  return found;
};

// ─── toTable ───────────────────────────────────────

describe('toTable', () => {
  it('describes one column per stored field', () => {
    const table = toTable('products', Product);
    expect(table.name).toBe('products');
    expect(table.columns.map((c) => c.field)).toEqual([
      'id', 'categoryId', 'name', 'price', 'stock', 'active', 'note', 'createdAt',
    ]);
  });

  it('drops a many relation — the join lives on the other side', () => {
    const table = toTable('categories', Category);
    expect(table.columns.map((c) => c.field)).toEqual(['id', 'name', 'slug']);
  });

  it('names columns in snake_case', () => {
    expect(column(toTable('products', Product), 'categoryId').name).toBe('category_id');
  });

  it('marks the primary key', () => {
    const table = toTable('products', Product);
    expect(column(table, 'id').primary).toBe(true);
    expect(column(table, 'name').primary).toBe(false);
    expect(table.compositePrimary).toEqual([]);
  });

  it('unwraps the nullable union so the type survives', () => {
    const note = column(toTable('products', Product), 'note');
    expect(note.nullable).toBe(true);
    expect(note.shape?.type).toBe('string');
  });

  it('carries a literal default', () => {
    expect(column(toTable('products', Product), 'active').default).toBe(true);
  });

  it('keeps an enum as a string shape', () => {
    expect(column(toTable('orders', Order), 'status').shape?.type).toBe('string');
  });
});

// ─── isKeyed ───────────────────────────────────────

describe('isKeyed', () => {
  it('is true for the primary key only', () => {
    const table = toTable('products', Product);
    expect(isKeyed(table, column(table, 'id'))).toBe(true);
    expect(isKeyed(table, column(table, 'name'))).toBe(false);
  });
});

// ─── dialects ──────────────────────────────────────

describe('columnType', () => {
  const table = toTable('products', Product);
  const typeOf = (dialect: keyof typeof dialects, field: string) => {
    const col = column(table, field);
    return dialects[dialect].columnType(col, isKeyed(table, col));
  };

  it('maps integers', () => {
    expect(typeOf('sqlite', 'stock')).toBe('integer');
    expect(typeOf('pg', 'stock')).toBe('integer');
    expect(typeOf('mysql', 'stock')).toBe('int');
    expect(typeOf('mssql', 'stock')).toBe('int');
  });

  it('maps floats', () => {
    expect(typeOf('sqlite', 'price')).toBe('real');
    expect(typeOf('pg', 'price')).toBe('double precision');
    expect(typeOf('mysql', 'price')).toBe('double');
    expect(typeOf('mssql', 'price')).toBe('float');
  });

  it('maps booleans — an int in SQLite, a real type elsewhere', () => {
    expect(typeOf('sqlite', 'active')).toBe('integer');
    expect(typeOf('pg', 'active')).toBe('boolean');
    expect(typeOf('mysql', 'active')).toBe('boolean');
    expect(typeOf('mssql', 'active')).toBe('bit');
  });

  it('maps an embedded object to the engine JSON type', () => {
    const orders = toTable('orders', Order);
    const meta = orders.columns.find((c) => c.field === 'meta')!;
    expect(dialects.sqlite.columnType(meta, false)).toBe('text');
    expect(dialects.pg.columnType(meta, false)).toBe('jsonb');
    expect(dialects.mysql.columnType(meta, false)).toBe('json');
    expect(dialects.mssql.columnType(meta, false)).toBe('nvarchar(max)');
  });

  it('narrows a key column where text cannot be indexed', () => {
    // `name` is plain text everywhere; `id` is a key.
    expect(typeOf('mysql', 'name')).toBe('text');
    expect(typeOf('mssql', 'name')).toBe('nvarchar(max)');
    expect(typeOf('mysql', 'id')).toBe('varchar(255)');
    expect(typeOf('mssql', 'id')).toBe('nvarchar(255)');
    // SQLite and Postgres index text directly — no narrowing.
    expect(typeOf('sqlite', 'id')).toBe('text');
    expect(typeOf('pg', 'id')).toBe('text');
  });
});

describe('supportsReturning', () => {
  it('splits the engines that have RETURNING from those that do not', () => {
    expect(dialects.sqlite.supportsReturning).toBe(true);
    expect(dialects.pg.supportsReturning).toBe(true);
    expect(dialects.mysql.supportsReturning).toBe(false);
    expect(dialects.mssql.supportsReturning).toBe(false);
  });
});
