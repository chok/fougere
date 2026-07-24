/**
 * The diff, against a real SQLite database.
 *
 * The case that matters: a field added to an entity whose table already exists.
 * The old create-if-not-exists pass ignored it silently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, optional, bool } from '@fougere/schema';
import { setupSqlite, type SqliteSetup } from '../src/index.js';
import { actualState, delta, desiredTables, planMigration, migrate, changeSQL } from '../src/diff.js';

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
    const ormV1 = setup.ormFactory(PostV1, 'post');
    const { id } = await ormV1.create({ title: 'Hello' });

    await migrate(appOf(PostV2), setup.db);
    const ormV2 = setup.ormFactory(PostV2, 'post');

    const row: any = await ormV2.findById(id);
    expect(row.title).toBe('Hello');
    expect(row.views).toBe(0); // the default answered the existing row
    expect(row.note).toBeNull();

    await ormV2.update(id, { views: 7 });
    expect((await ormV2.findById(id) as any).views).toBe(7);
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
