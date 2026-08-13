import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, created, oneOf, ref, optional, many, json, reconstruct, type EntityConstructor } from '@fougere/schema';
import { toTable, isKeyed, dialects, type ColumnDef } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────────

class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
  products: many((): EntityConstructor => Product),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1, max: 255 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  note: optional(text()),
  createdAt: created(),
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

// ─── references — the FK a ref() field describes ───

describe('references', () => {
  it('resolves the target via the identity map when the target is part of the same batch', () => {
    const tableNameOf = new Map<any, string>([[Category, 'categories']]);
    const table = toTable('products', Product, { resolve: (n) => `custom_${n}`, tableNameOf });
    expect(column(table, 'categoryId').references).toEqual({ table: 'categories', column: 'id' });
  });

  it('falls back to deriving the name from the class when there is no identity map', () => {
    // No `relations` option — the default resolver (camelCase → snake_case + 's')
    // applied to the class name is all that's left.
    const table = toTable('products', Product);
    expect(column(table, 'categoryId').references).toEqual({ table: 'categorys', column: 'id' });
  });

  it('an identity map miss still derives a name, even off a custom resolver', () => {
    // `Category` is a live class, but absent from `tableNameOf` (e.g. it lives in
    // another frond's batch) — the resolver still runs, just on the derived name.
    const table = toTable('products', Product, { resolve: (n) => `zz_${n}`, tableNameOf: new Map() });
    expect(column(table, 'categoryId').references?.table).toBe('zz_category');
  });

  it("resolves the target's real primary key column, not just a guess", () => {
    class Tag extends entity({ slug: primary(), label: text({ min: 1 }) }) {}
    class Post extends entity({ id: primary(), tagSlug: ref(Tag) }) {}
    const table = toTable('posts', Post, { resolve: (n) => `${n}s`, tableNameOf: new Map<any, string>([[Tag, 'tags']]) });
    expect(column(table, 'tagSlug').references).toEqual({ table: 'tags', column: 'slug' });
  });

  it('carries onDelete only when the field declares it', () => {
    class CascadingProduct extends entity({ id: primary(), categoryId: ref(Category, { cascade: true }) }) {}
    const cascading = toTable('products', CascadingProduct);
    expect(cascading.columns[1].references?.onDelete).toBe('cascade');
    expect(column(toTable('products', Product), 'categoryId').references?.onDelete).toBeUndefined();
  });

  it('assumes the PK is "id" for a relation reconstructed from a lone card — the thunk is gone', () => {
    const card = {
      title: 'post',
      type: 'object' as const,
      properties: {
        id: { type: 'string', 'x-fougere': { role: { primary: true } } },
        tagSlug: { type: 'string', 'x-fougere': { role: { relation: { to: 'tag', kind: 'one' as const } } } },
      },
      required: ['tagSlug'],
      'x-fougere-version': 1 as const,
      'x-fougere-vendor': 'fougere' as const,
    };
    const Post = reconstruct(card as any);
    const table = toTable('posts', Post, { resolve: (n) => `${n}s` });
    expect(column(table, 'tagSlug').references).toEqual({ table: 'tags', column: 'id' });
  });

  it('a many relation owns no column, so it carries no reference either', () => {
    const table = toTable('categories', Category);
    expect(table.columns.find((c) => c.field === 'products')).toBeUndefined();
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
