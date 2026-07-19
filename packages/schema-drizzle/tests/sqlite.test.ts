import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, oneOf, ref, optional } from '@fougere/schema';
import { toSqliteTables, toSqliteTable } from '../src/index.js';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

// ─── Fixtures ──────────────────────────────────────

class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1, max: 255 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  createdAt: auto(),
}) {}

class Order extends entity({
  id: primary(),
  status: oneOf('draft', 'pending', 'paid'),
  note: optional(text()),
  total: number({ min: 0 }),
}) {}

// ─── Tests ─────────────────────────────────────────

describe('toSqliteTable', () => {
  it('generates a table with correct columns', () => {
    const table = toSqliteTable('categories', Category);
    const config = getTableConfig(table);

    expect(config.name).toBe('categories');
    expect(config.columns.length).toBe(3);

    const names = config.columns.map(c => c.name);
    expect(names).toContain('id');
    expect(names).toContain('name');
    expect(names).toContain('slug');
  });

  it('maps camelCase fields to snake_case columns', () => {
    const table = toSqliteTable('products', Product);
    const config = getTableConfig(table);

    const names = config.columns.map(c => c.name);
    expect(names).toContain('category_id');
    expect(names).toContain('created_at');
  });

  it('sets primary key on uuid/primary fields', () => {
    const table = toSqliteTable('categories', Category);
    const config = getTableConfig(table);

    const idCol = config.columns.find(c => c.name === 'id')!;
    expect(idCol.primary).toBe(true);
  });

  it('marks non-nullable fields as notNull', () => {
    const table = toSqliteTable('categories', Category);
    const config = getTableConfig(table);

    const nameCol = config.columns.find(c => c.name === 'name')!;
    expect(nameCol.notNull).toBe(true);
  });

  it('allows nullable fields', () => {
    const table = toSqliteTable('orders', Order);
    const config = getTableConfig(table);

    const noteCol = config.columns.find(c => c.name === 'note')!;
    expect(noteCol.notNull).toBe(false);
  });

  it('uses integer for integer numbers, real for floats', () => {
    const table = toSqliteTable('products', Product);
    const config = getTableConfig(table);

    const stockCol = config.columns.find(c => c.name === 'stock')!;
    expect(stockCol.columnType).toBe('SQLiteInteger');

    const priceCol = config.columns.find(c => c.name === 'price')!;
    expect(priceCol.columnType).toBe('SQLiteReal');
  });

  it('uses integer with boolean mode for bool fields', () => {
    const table = toSqliteTable('products', Product);
    const config = getTableConfig(table);

    const activeCol = config.columns.find(c => c.name === 'active')!;
    // drizzle-orm v0.45+ uses SQLiteBoolean for boolean mode
    expect(activeCol.columnType).toMatch(/SQLite(Integer|Boolean)/);
  });

  it('sets default values', () => {
    const table = toSqliteTable('products', Product);
    const config = getTableConfig(table);

    const activeCol = config.columns.find(c => c.name === 'active')!;
    expect(activeCol.default).toBe(true);
  });
});

describe('toSqliteTables', () => {
  it('generates multiple tables at once', () => {
    const tables = toSqliteTables({
      categories: Category,
      products: Product,
      orders: Order,
    });

    expect(getTableConfig(tables.categories).name).toBe('categories');
    expect(getTableConfig(tables.products).name).toBe('products');
    expect(getTableConfig(tables.orders).name).toBe('orders');
  });

  it('resolves references between tables', () => {
    const tables = toSqliteTables({
      categories: Category,
      products: Product,
    });

    const config = getTableConfig(tables.products);
    const catIdCol = config.columns.find(c => c.name === 'category_id')!;
    // Le champ a une foreign key
    expect(config.foreignKeys.length).toBeGreaterThan(0);
  });

  it('accepts custom table names', () => {
    const tables = toSqliteTables({
      cat: { tableName: 'my_categories', entity: Category },
      prod: { tableName: 'my_products', entity: Product },
    });

    expect(getTableConfig(tables.cat).name).toBe('my_categories');
    expect(getTableConfig(tables.prod).name).toBe('my_products');
  });
});

describe('value list (list())', () => {
  it('maps a list field to a JSON text column', async () => {
    const { list } = await import('@fougere/schema');
    class Tagged extends entity({ id: primary(), tags: list(text()) }) {}
    const table = toSqliteTable('tagged', Tagged);
    const config = getTableConfig(table);
    const tagsCol = config.columns.find(c => c.name === 'tags')!;
    expect(tagsCol.columnType).toBe('SQLiteTextJson');
    expect(tagsCol.notNull).toBe(true);
  });
});
