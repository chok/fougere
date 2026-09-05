/**
 * The diff, against a real SQLite database.
 *
 * The case that matters: a field added to an entity whose table already exists.
 * The old create-if-not-exists pass ignored it silently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, optional, bool, ref, unique, type EntityConstructor } from '@fougere/schema';
import { sql } from 'kysely';
import { setupSqlite, type SqliteSetup } from '../src/sqlite.js';
import { actualState, delta, desiredTables, orderChanges, planMigration, migrate, changeSQL } from '../src/diff.js';

class PostV1 extends entity({
  id: primary(),
  title: text({ min: 1 }),
}) {}

/** Same entity, later: two fields added. */
class PostV2 extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true, default: 0 }),
  note: optional(text()),
}) {}

const appOf = (entityClass: any) => ({
  fronds: [{ name: 'test', entities: [{ name: 'post', entityClass }] }],
});

let setup: SqliteSetup;

beforeEach(() => {
  setup = setupSqlite({ path: ':memory:' });
});

describe('actualState', () => {
  it('is empty on a fresh database', async () => {
    expect((await actualState(setup.db)).size).toBe(0);
  });

  it('reports tables and their columns after a migration', async () => {
    await migrate(appOf(PostV1), setup.db);
    const state = await actualState(setup.db);
    expect(state.has('posts')).toBe(true);
    expect([...state.get('posts')!].sort()).toEqual(['id', 'title']);
  });
});

describe('delta', () => {
  it('asks to create a missing table', () => {
    const changes = delta(desiredTables(appOf(PostV1)), new Map());
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('createTable');
  });

  it('asks for nothing when the database already matches', async () => {
    await migrate(appOf(PostV1), setup.db);
    expect(delta(desiredTables(appOf(PostV1)), await actualState(setup.db))).toEqual([]);
  });

  it('asks to add the columns an entity gained', async () => {
    await migrate(appOf(PostV1), setup.db);
    const changes = delta(desiredTables(appOf(PostV2)), await actualState(setup.db));
    expect(changes.map((c) => c.kind)).toEqual(['addColumn', 'addColumn']);
    expect(changes.map((c: any) => c.column.name)).toEqual(['views', 'note']);
  });

  it('never asks to drop a column the entity no longer has', async () => {
    await migrate(appOf(PostV2), setup.db);
    // Going back to V1 — two columns are now extra.
    expect(delta(desiredTables(appOf(PostV1)), await actualState(setup.db))).toEqual([]);
  });
});

describe('changeSQL', () => {
  it('renders ALTER TABLE ADD for a new column', async () => {
    await migrate(appOf(PostV1), setup.db);
    const [change] = delta(desiredTables(appOf(PostV2)), await actualState(setup.db));
    expect(changeSQL(change, 'sqlite')).toContain('alter table "posts" add column "views"');
  });

  it('keeps not null only when a default answers existing rows', async () => {
    await migrate(appOf(PostV1), setup.db);
    const changes = delta(desiredTables(appOf(PostV2)), await actualState(setup.db));
    const views = changeSQL(changes[0], 'sqlite'); // has default 0
    const note = changeSQL(changes[1], 'sqlite'); // optional, no default
    expect(views).toContain('not null');
    expect(note).not.toContain('not null');
  });

  it('renders per dialect', async () => {
    await migrate(appOf(PostV1), setup.db);
    const [change] = delta(desiredTables(appOf(PostV2)), await actualState(setup.db));
    expect(changeSQL(change, 'mysql')).toContain('`views` int');
    expect(changeSQL(change, 'pg')).toContain('"views" integer');
  });
});

describe('migrate', () => {
  it('creates then adds, and reports what it did', async () => {
    const first = await migrate(appOf(PostV1), setup.db);
    expect(first.map((c) => c.kind)).toEqual(['createTable']);

    const second = await migrate(appOf(PostV2), setup.db);
    expect(second.map((c) => c.kind)).toEqual(['addColumn', 'addColumn']);

    // Third pass is a no-op — the database now matches.
    expect(await migrate(appOf(PostV2), setup.db)).toEqual([]);
  });

  it('the added column is usable, and existing rows survive', async () => {
    await migrate(appOf(PostV1), setup.db);
    const ormV1 = setup.storageFactory(PostV1, 'post');
    // The storage answers rows as `Record<string, unknown>` — it realises a schema it
    // does not carry as a type. The generated id is a string; say so once here.
    const id = String((await ormV1.create({ title: 'Hello' })).id);

    await migrate(appOf(PostV2), setup.db);
    const ormV2 = setup.storageFactory(PostV2, 'post');

    const row: any = await ormV2.findById(id);
    expect(row.title).toBe('Hello');
    expect(row.views).toBe(0); // the default answered the existing row
    expect(row.note).toBeNull();

    await ormV2.update(id, { views: 7 });
    expect((await ormV2.findById(id) as any).views).toBe(7);
  });
});

describe('what a migrated table promises', () => {
  /**
   * Two databases of one entity used to promise different things: `createTable` stated
   * NOT NULL whatever happened, `addColumn` only when a default filled the column.
   */
  it('states a required column on a table that already existed', async () => {
    class V1 extends entity({ id: primary(), title: text({ min: 1 }) }) {}
    class V2 extends entity({ id: primary(), title: text({ min: 1 }), slug: text({ min: 1 }) }) {}

    await migrate(appOf(V1), setup.db);
    await migrate(appOf(V2), setup.db);

    await expect(sql.raw(`insert into posts (id, title) values ('a', 'x')`).execute(setup.db))
      .rejects.toThrow(/NOT NULL/i);
  });

  /** `unique()` was declared as a column constraint, which only a fresh table ever read. */
  it('realizes a unique added to a live column, rather than declaring it alone', async () => {
    class V1 extends entity({ id: primary(), title: text({ min: 1 }) }) {}
    class V2 extends entity({ id: primary(), title: unique(text({ min: 1 })) }) {}

    await migrate(appOf(V1), setup.db);
    const storage = setup.storageFactory(V1, 'post');
    await storage.create({ title: 'once' });

    await migrate(appOf(V2), setup.db);

    await expect(setup.storageFactory(V2, 'post').create({ title: 'once' }))
      .rejects.toThrow(/already exist/i);
  });

  /** The refusal is the answer: the rows already break what the entity now states. */
  it('fails to add that unique when the rows already break it', async () => {
    class V1 extends entity({ id: primary(), title: text({ min: 1 }) }) {}
    class V2 extends entity({ id: primary(), title: unique(text({ min: 1 })) }) {}

    await migrate(appOf(V1), setup.db);
    const storage = setup.storageFactory(V1, 'post');
    await storage.create({ title: 'twice' });
    await storage.create({ title: 'twice' });

    await expect(migrate(appOf(V2), setup.db)).rejects.toThrow(/UNIQUE|duplicate/i);
  });
});

describe('planMigration', () => {
  it('reports without touching the database', async () => {
    const { changes, statements } = await planMigration(appOf(PostV1), setup.db);
    expect(changes).toHaveLength(1);
    expect(statements[0]).toContain('create table');
    // Nothing ran.
    expect((await actualState(setup.db)).size).toBe(0);
  });
});

// ─── Foreign keys — the real point of this file: PRAGMA foreign_keys is ON ─

class Category extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1 }),
}) {}

const shopApp = (entities: { name: string; entityClass: any }[]) => ({
  fronds: [{ name: 'shop', entities }],
});

describe('foreign keys, enforced', () => {
  it('an invalid reference is now rejected on insert — it silently passed before this constraint existed', async () => {
    await migrate(shopApp([
      { name: 'category', entityClass: Category },
      { name: 'product', entityClass: Product },
    ]), setup.db);

    const productStorage = setup.storageFactory(Product, 'product');
    await expect(
      productStorage.create({ categoryId: 'does-not-exist', name: 'Fern' }),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it('a valid reference still inserts fine', async () => {
    await migrate(shopApp([
      { name: 'category', entityClass: Category },
      { name: 'product', entityClass: Product },
    ]), setup.db);

    const categoryStorage = setup.storageFactory(Category, 'category');
    const productStorage = setup.storageFactory(Product, 'product');
    const plants = await categoryStorage.create({ name: 'Plants' });
    const fern = await productStorage.create({ categoryId: (plants as any).id, name: 'Fern' });
    expect((fern as any).categoryId).toBe((plants as any).id);
  });

  it('a new ref() field added later gets its FK too, inline in the ADD COLUMN', async () => {
    await migrate(shopApp([{ name: 'category', entityClass: Category }]), setup.db);
    class CategoryV2 extends entity({
      id: primary(),
      name: text({ min: 1 }),
      parentId: optional(ref(Category)),
    }) {}
    const { statements } = await planMigration(shopApp([{ name: 'category', entityClass: CategoryV2 }]), setup.db);
    expect(statements[0]).toContain('references "categorys" ("id")');
  });
});

// ─── A relation cycle — legal in the model ─────────

// One direction nullable — a real insert has to break the loop somewhere
// (SQLite checks a FK immediately, no deferred constraints), the same way a
// hand-written schema would model a mutual reference.
class Club extends entity({
  id: primary(),
  name: text({ min: 1 }),
  captainId: optional(ref((): EntityConstructor => Captain)),
}) {}

class Captain extends entity({
  id: primary(),
  name: text({ min: 1 }),
  clubId: ref(Club),
}) {}

const clubApp = shopApp([
  { name: 'club', entityClass: Club },
  { name: 'captain', entityClass: Captain },
]);

describe('a relation cycle does not break the migration', () => {
  it('migrates on real SQLite without error — lazy FK resolution needs no cycle-breaking', async () => {
    const changes = await migrate(clubApp, setup.db);
    expect(changes.map((c) => c.kind)).toEqual(['createTable', 'createTable']);
    const state = await actualState(setup.db);
    expect(state.has('clubs')).toBe(true);
    expect(state.has('captains')).toBe(true);
  });

  it('a captain can reference its club, and the club its captain back', async () => {
    await migrate(clubApp, setup.db);
    const clubStorage = setup.storageFactory(Club, 'club');
    const captainStorage = setup.storageFactory(Captain, 'captain');
    // Break the loop where it's nullable: club first (no captain yet), then the
    // captain referencing it, then close the loop with an update.
    const club = await clubStorage.create({ name: 'Rovers' });
    const captain = await captainStorage.create({ name: 'Sam', clubId: (club as any).id });
    await clubStorage.update((club as any).id, { captainId: (captain as any).id });
    expect((await clubStorage.findById((club as any).id) as any).captainId).toBe((captain as any).id);
  });

  it.each(['pg', 'mysql', 'mssql'] as const)('%s plans it as two creates plus a deferred constraint', async (dialect) => {
    const { changes, statements } = await planMigration(clubApp, setup.db, { dialect });
    expect(changes.map((c) => c.kind)).toEqual(['createTable', 'createTable', 'addConstraint']);
    expect(statements).toHaveLength(3);
    expect(statements[2]).toMatch(/alter table .* add constraint .* foreign key/);
    // The deferred column's own CREATE carries no inline reference to it.
    const creates = statements.slice(0, 2);
    expect(creates.filter((s) => s.includes('references'))).toHaveLength(1);
  });
});

// ─── orderChanges — pure, dialect-aware reordering ──

describe('orderChanges', () => {
  it('passes SQLite changes through unchanged', () => {
    const changes = delta(desiredTables(clubApp), new Map());
    expect(orderChanges(changes, 'sqlite')).toBe(changes);
  });

  it('reorders createTable changes so a referenced table comes first (pg)', () => {
    // Declared in reverse dependency order: Product before its Category.
    const app = shopApp([
      { name: 'product', entityClass: Product },
      { name: 'category', entityClass: Category },
    ]);
    const changes = delta(desiredTables(app), new Map());
    const ordered = orderChanges(changes, 'pg');
    expect(ordered.map((c) => (c as any).table.name)).toEqual(['categorys', 'products']);
  });
});
