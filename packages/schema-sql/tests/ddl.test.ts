import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, optional, many, ref, reconstruct, type EntityConstructor } from '@fougere/schema';
import { createTableSQL, generateSQL, toTable, addForeignKeyConstraintSQL } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────────

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
  posts: many((): EntityConstructor => Post),
}) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true }),
  score: number(),
  active: bool({ default: true }),
  note: optional(text()),
  createdAt: auto(),
}) {}

class Membership extends entity({
  userId: primary(),
  groupId: primary(),
  role: text(),
}) {}

class Category extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1 }),
}) {}

// A relation cycle, legal in the model (role.ts's relation thunk exists precisely
// so two entities can reference each other): Club → Captain → Club.
// The thunk defers the VALUE, not the TYPE: inferring `Club` would still require
// inferring `Captain`, which requires `Club`. `ref()` returns `Field<string>` whatever
// its target, so widening the annotation cuts the loop without losing anything —
// a cycle in the data is legal, a cycle in inference is not.
class Club extends entity({
  id: primary(),
  name: text({ min: 1 }),
  captainId: ref((): EntityConstructor => Captain),
}) {}

class Captain extends entity({
  id: primary(),
  name: text({ min: 1 }),
  clubId: ref(Club),
}) {}

const fakeApp = (entities: { name: string; entityClass: any }[]) => ({
  fronds: [{ name: 'test', entities }],
});

const ddl = (name: string, e: any, dialect: any = 'sqlite') => createTableSQL(toTable(name, e), dialect);

// ─── Parity with the previous generator ────────────

describe('createTableSQL — sqlite parity', () => {
  it('creates the table with its columns', () => {
    const sql = ddl('authors', Author);
    expect(sql).toContain('create table if not exists "authors"');
    expect(sql).toContain('"id" text not null primary key');
    expect(sql).toContain('"name" text not null');
    expect(sql).toContain('"email" text not null');
  });

  it('maps number(integer) to integer, number to real', () => {
    const sql = ddl('posts', Post);
    expect(sql).toContain('"views" integer not null');
    expect(sql).toContain('"score" real not null');
  });

  it('maps bool to integer, carrying its default', () => {
    expect(ddl('posts', Post)).toContain('"active" integer default true not null');
  });

  it('leaves a nullable column without not null', () => {
    const sql = ddl('posts', Post);
    expect(sql).toMatch(/"note" text[,)]/);
  });

  it('names columns in snake_case', () => {
    const sql = ddl('posts', Post);
    expect(sql).toContain('"created_at"');
    expect(sql).not.toContain('createdAt');
  });

  it('drops a many relation', () => {
    expect(ddl('authors', Author)).not.toContain('"posts"');
  });

  it('emits a table constraint for a composite key', () => {
    const sql = ddl('memberships', Membership);
    expect(sql).toContain('constraint "memberships_pk" primary key ("user_id", "group_id")');
    expect(sql).not.toMatch(/"user_id"[^,]*primary key,/);
  });
});

// ─── Dialects ──────────────────────────────────────

describe('createTableSQL — across dialects', () => {
  it('picks each engine type for the same entity', () => {
    expect(ddl('posts', Post, 'pg')).toContain('"score" double precision not null');
    expect(ddl('posts', Post, 'mysql')).toContain('`score` double not null');
    expect(ddl('posts', Post, 'mssql')).toContain('"score" float not null');
  });

  it('quotes identifiers the way each engine does', () => {
    expect(ddl('posts', Post, 'mysql')).toContain('`posts`');
    expect(ddl('posts', Post, 'pg')).toContain('"posts"');
  });

  it('narrows the key column where text is not indexable', () => {
    expect(ddl('posts', Post, 'mysql')).toContain('`id` varchar(255) not null primary key');
    expect(ddl('posts', Post, 'mssql')).toContain('"id" nvarchar(255) not null primary key');
    expect(ddl('posts', Post, 'pg')).toContain('"id" text not null primary key');
  });

  it('omits if not exists on SQL Server, which has no such clause', () => {
    expect(ddl('posts', Post, 'mssql')).toMatch(/^create table "posts"/);
    expect(ddl('posts', Post, 'pg')).toMatch(/^create table if not exists/);
  });
});

// ─── generateSQL ───────────────────────────────────

describe('generateSQL', () => {
  it('emits one statement per entity', () => {
    const statements = generateSQL(fakeApp([
      { name: 'author', entityClass: Author },
      { name: 'post', entityClass: Post },
    ]));
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('"authors"');
    expect(statements[1]).toContain('"posts"');
  });

  it('respects a custom tableName', () => {
    const [sql] = generateSQL(fakeApp([{ name: 'author', entityClass: Author }]), {
      tableName: (name) => `app_${name}`,
    });
    expect(sql).toContain('create table if not exists "app_author"');
  });

  it('includes auth runtime entities', () => {
    const app = { ...fakeApp([]), auth: { entities: { user: Author } } };
    expect(generateSQL(app)[0]).toContain('"users"');
  });

  it('targets the requested dialect', () => {
    const [sql] = generateSQL(fakeApp([{ name: 'post', entityClass: Post }]), { dialect: 'pg' });
    expect(sql).toContain('double precision');
  });
});

// ─── Foreign keys — inline, per dialect ────────────

describe('createTableSQL — foreign keys', () => {
  it('emits an inline reference for every dialect', () => {
    const table = toTable('products', Product, { resolve: (n) => `${n}s`, tableNameOf: new Map<any, string>([[Category, 'categorys']]) });
    for (const dialect of ['sqlite', 'pg', 'mysql', 'mssql'] as const) {
      const sql = createTableSQL(table, dialect);
      expect(sql).toMatch(/references [`"]categorys[`"] \([`"]id[`"]\)/);
    }
  });

  it('carries onDelete when the field declares cascade', () => {
    class CascadingProduct extends entity({ id: primary(), categoryId: ref(Category, { cascade: true }) }) {}
    const table = toTable('products', CascadingProduct);
    expect(createTableSQL(table, 'pg')).toContain('on delete cascade');
  });

  it('omits the constraint clause when nothing is declared', () => {
    const table = toTable('products', Product);
    expect(createTableSQL(table, 'pg')).not.toContain('on delete');
  });

  it('a self-reference stays inline — no ordering or deferral needed', () => {
    // Self-reference: same inference loop as Club/Captain, one entity instead of two.
    class Node extends entity({ id: primary(), parentId: optional(ref((): EntityConstructor => Node)) }) {}
    const table = toTable('nodes', Node);
    expect(createTableSQL(table, 'pg')).toContain('references "nodes" ("id")');
  });

  it('skipReferences renders the column without its inline FK', () => {
    const table = toTable('products', Product, { resolve: (n) => `${n}s`, tableNameOf: new Map<any, string>([[Category, 'categorys']]) });
    const sql = createTableSQL(table, 'pg', { skipReferences: new Set(['category_id']) });
    expect(sql).not.toContain('references');
  });
});

describe('addForeignKeyConstraintSQL', () => {
  it('renders ALTER TABLE ADD CONSTRAINT, per dialect', () => {
    const table = toTable('products', Product, { resolve: (n) => `${n}s`, tableNameOf: new Map<any, string>([[Category, 'categorys']]) });
    const column = table.columns.find((c) => c.field === 'categoryId')!;
    expect(addForeignKeyConstraintSQL(table, column, 'pg')).toBe(
      'alter table "products" add constraint "products_category_id_fk" foreign key ("category_id") references "categorys" ("id")',
    );
    expect(addForeignKeyConstraintSQL(table, column, 'mysql')).toContain('add constraint `products_category_id_fk`');
  });
});

// ─── generateSQL — FK ordering across engines ──────

describe('generateSQL — FK ordering', () => {
  const shopApp = (entities: { name: string; entityClass: any }[]) => ({ fronds: [{ name: 'shop', entities }] });

  it('SQLite keeps declaration order — lazy FK resolution needs no sort', () => {
    // Declared in reverse dependency order: Product before its Category.
    const statements = generateSQL(shopApp([
      { name: 'product', entityClass: Product },
      { name: 'category', entityClass: Category },
    ]));
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('"products"');
    expect(statements[1]).toContain('"categorys"');
  });

  it.each(['pg', 'mysql', 'mssql'] as const)('%s reorders so the referenced table is created first', (dialect) => {
    const statements = generateSQL(shopApp([
      { name: 'product', entityClass: Product },
      { name: 'category', entityClass: Category },
    ]), { dialect });
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('categorys');
    expect(statements[1]).toContain('products');
  });

  it('a custom tableName resolver is honored for the FK target too — not re-derived', () => {
    const tableName = (name: string) => (name === 'category' ? 'categories' : `${name}s`);
    const statements = generateSQL(shopApp([
      { name: 'category', entityClass: Category },
      { name: 'product', entityClass: Product },
    ]), { tableName });
    expect(statements[1]).toContain('references "categories" ("id")');
  });
});

describe('generateSQL — a relation cycle', () => {
  const clubApp = (entities: { name: string; entityClass: any }[]) => ({ fronds: [{ name: 'club', entities }] });

  it('SQLite inlines both FKs — no cycle-breaking needed', () => {
    const statements = generateSQL(clubApp([
      { name: 'club', entityClass: Club },
      { name: 'captain', entityClass: Captain },
    ]));
    expect(statements).toHaveLength(2);
    expect(statements.join('\n')).toContain('references "captains"');
    expect(statements.join('\n')).toContain('references "clubs"');
  });

  it.each(['pg', 'mysql', 'mssql'] as const)('%s defers one edge to ALTER TABLE ADD CONSTRAINT', (dialect) => {
    const statements = generateSQL(clubApp([
      { name: 'club', entityClass: Club },
      { name: 'captain', entityClass: Captain },
    ]), { dialect });
    expect(statements).toHaveLength(3);
    // Exactly one of the two creates carries no inline FK — the deferred one.
    const creates = statements.slice(0, 2);
    expect(creates.filter((s) => s.includes('references'))).toHaveLength(1);
    // The third statement closes the loop.
    expect(statements[2]).toMatch(/alter table .* add constraint .* foreign key/);
  });
});

// ─── Language independence ─────────────────────────

describe('a card is enough', () => {
  // The very card the Rust frond serves on rpc.discover — no TS entity exists.
  const card = {
    title: 'sensor',
    type: 'object' as const,
    properties: {
      id: { type: 'string', format: 'uuid', 'x-fougere': { role: { primary: true } } },
      label: { type: 'string', minLength: 2, maxLength: 40 },
      celsius: { type: 'number', minimum: -80, maximum: 80 },
      recordedAt: { type: 'string', format: 'date-time', 'x-fougere': { lifecycle: { create: 'now' } } },
    },
    required: ['label', 'celsius'],
    'x-fougere-version': 1 as const,
    'x-fougere-vendor': 'fougere' as const,
  };

  it('generates DDL from a foreign schema, with no entity class', () => {
    const Sensor = reconstruct(card as any);
    expect(ddl('sensors', Sensor, 'pg')).toContain('"celsius" double precision not null');
    expect(ddl('sensors', Sensor, 'mssql')).toContain('"id" nvarchar(255) not null primary key');
    expect(ddl('sensors', Sensor, 'sqlite')).toContain('"recorded_at" text not null');
  });
});
