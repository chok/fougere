/**
 * The ORM against a real SQLite database — not a mock.
 *
 * The whole chain is exercised: DDL from the entity, Kysely's SQL, the
 * field↔column mapping, and the lifecycle rules realised on write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, bool, created, updated, optional } from '@fougere/schema';
import { setupSqlite, autoMigrate, type SqliteSetup } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  body: text(),
  secret: text(),
  views: number({ integer: true, default: 0 }),
  published: bool({ default: false }),
  note: optional(text()),
  createdAt: created(),
  updatedAt: updated(),
}) {}

const PostPublic = Post.omit('secret');

let setup: SqliteSetup;
let orm: any;

beforeEach(async () => {
  setup = setupSqlite({ path: ':memory:' });
  await autoMigrate({ fronds: [{ name: 'test', entities: [{ name: 'post', entityClass: Post }] }] }, setup.sqlite);
  orm = setup.ormFactory(Post, 'post');
});

const seed = (title: string) => orm.create({ title, body: 'b', secret: 's' });

describe('create', () => {
  it('generates the primary key and returns the complete row', async () => {
    const post = await seed('Hello');
    expect(post.id).toMatch(/.+/);
    expect(post.title).toBe('Hello');
    // Defaults realised by SQL come back, because create re-reads the row.
    expect(post.views).toBe(0);
    // The column holds 0; the field declares a boolean, so that is what comes back.
    expect(post.published).toBe(false);
  });

  it('stamps a managed creation timestamp', async () => {
    const post = await seed('Hello');
    expect(post.createdAt).toBeInstanceOf(Date);
    expect(post.createdAt).not.toBe('');
  });

  it('maps camelCase fields onto snake_case columns', async () => {
    const post = await seed('Hello');
    // The caller sees entity names…
    expect(post).toHaveProperty('createdAt');
    expect(post).not.toHaveProperty('created_at');
    // …while the table carries SQL names.
    const raw = setup.sqlite.prepare('select * from posts').get() as Record<string, unknown>;
    expect(raw).toHaveProperty('created_at');
    expect(raw).not.toHaveProperty('createdAt');
  });
});

describe('findById / findBy / findAllBy', () => {
  it('reads back by primary key', async () => {
    const { id } = await seed('Hello');
    expect((await orm.findById(id)).title).toBe('Hello');
  });

  it('returns undefined for a missing row', async () => {
    expect(await orm.findById('nope')).toBeUndefined();
  });

  it('finds by criteria', async () => {
    await seed('A');
    await seed('B');
    expect((await orm.findBy({ title: 'B' })).title).toBe('B');
    expect(await orm.findAllBy({ body: 'b' })).toHaveLength(2);
  });
});

describe('update', () => {
  it('writes and returns the complete row', async () => {
    const { id } = await seed('Hello');
    const updatedRow = await orm.update(id, { title: 'Changed' });
    expect(updatedRow.title).toBe('Changed');
    expect(updatedRow.body).toBe('b');
  });

  it('stamps updatedAt even when absent from the input', async () => {
    const { id } = await seed('Hello');
    const before = (await orm.findById(id)).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const after = (await orm.update(id, { title: 'Changed' })).updatedAt;
    expect(after).not.toBe(before);
  });
});

describe('delete', () => {
  it('removes the row and reports it', async () => {
    const { id } = await seed('Hello');
    expect(await orm.delete(id)).toBe(true);
    expect(await orm.findById(id)).toBeUndefined();
  });

  it('reports false for a missing row', async () => {
    expect(await orm.delete('nope')).toBe(false);
  });
});

describe('list', () => {
  beforeEach(async () => {
    for (const title of ['A', 'B', 'C']) await seed(title);
  });

  it('returns every row', async () => {
    expect(await orm.list()).toHaveLength(3);
  });

  it('limits and reports hasMore', async () => {
    const page = await orm.list({ limit: 2 });
    expect(page).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.endCursor).toBeDefined();
  });

  it('orders by a field', async () => {
    const desc = await orm.list({ orderBy: 'title', order: 'desc' });
    expect(desc.map((p: any) => p.title)).toEqual(['C', 'B', 'A']);
  });

  it('counts on demand', async () => {
    expect((await orm.list({ count: true })).total).toBe(3);
  });

  it('counts what the filter matches, not what the table holds', async () => {
    await orm.update((await orm.list({ orderBy: 'title' }))[0].id, { published: true });

    const page = await orm.list({ where: { published: true }, count: true });
    expect(page).toHaveLength(1);
    // It used to answer 3 — the page was this filter's, the total was everybody's. A
    // paginator divided by the wrong number, and a tenant read the other tenants' size.
    expect(page.total).toBe(1);
  });

  it('counts the whole filter, not the page', async () => {
    // `limit` is the page and must not reach the count; `total` is what matches.
    const page = await orm.list({ limit: 2, count: true });
    expect(page).toHaveLength(2);
    expect(page.total).toBe(3);
  });

  it('offsets', async () => {
    expect(await orm.list({ offset: 2 })).toHaveLength(1);
  });
});

describe('output()', () => {
  it('restricts the fields a read hands back', async () => {
    const { id } = await seed('Hello');
    expect(await orm.findById(id)).toHaveProperty('secret');

    const scoped = await orm.output(PostPublic).findById(id);
    expect(scoped).toHaveProperty('title', 'Hello');
    expect(scoped).not.toHaveProperty('secret');
  });

  it('restricts on list too, keeping pagination metadata', async () => {
    await seed('B');
    await seed('C');
    const rows = await orm.output(PostPublic).list({ limit: 1 });
    expect(rows[0]).not.toHaveProperty('secret');
    expect(rows.hasMore).toBe(true);
  });

  it('leaves the unscoped ORM untouched', async () => {
    const { id } = await seed('Hello');
    orm.output(PostPublic);
    expect(await orm.findById(id)).toHaveProperty('secret');
  });
});

// ── a criterion may name a SET ────────────────────────────────────────────────

describe('a criterion naming a set', () => {
  it('reads them all in one query — the batch form a relation needs', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });
    await orm.create({ title: 'two', body: 'b', secret: 's' });
    const c = await orm.create({ title: 'three', body: 'c', secret: 's' });

    const rows = await orm.findAllBy({ id: [a.id, c.id] });
    expect(rows.map((r: any) => r.title).sort()).toEqual(['one', 'three']);
  });

  it('an empty set matches nothing — never the whole table', async () => {
    await orm.create({ title: 'one', body: 'a', secret: 's' });
    expect(await orm.findAllBy({ id: [] })).toEqual([]);
  });

  it('a repeated value is asked once, and one row comes back', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });
    expect(await orm.findAllBy({ id: [a.id, a.id] })).toHaveLength(1);
  });

  it('values cross the codec, as a single criterion already does', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });
    expect(await orm.findAllBy({ id: [a.id] })).toEqual([await orm.findById(a.id)]);
  });
});

// ── findByKeys: one query for N keys ─────────────────────────────────────────

describe('findByKeys', () => {
  it('answers a map keyed by the primary key — a page zips by key, not by position', async () => {
    await orm.create({ title: 'one', body: 'a', secret: 's' });
    const b = await orm.create({ title: 'two', body: 'b', secret: 's' });
    const c = await orm.create({ title: 'three', body: 'c', secret: 's' });

    const found = await orm.findByKeys([c.id, b.id]);
    expect(found.get(c.id)?.title).toBe('three');
    expect(found.get(b.id)?.title).toBe('two');
  });

  it('a miss is an absent key — not a hole, not an error', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });

    const found = await orm.findByKeys([a.id, 'never-created']);
    expect(found.size).toBe(1);
    expect(found.has('never-created')).toBe(false);
    expect((await orm.findByKeys([])).size).toBe(0);
  });

  it('a repeated key is queried once and is one entry — a map cannot hold it twice', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });
    const found = await orm.findByKeys([a.id, a.id]);
    expect(found.size).toBe(1);
    expect(found.get(a.id)?.title).toBe('one');
  });

  it('values cross the codec, as they do on every other read path', async () => {
    const a = await orm.create({ title: 'one', body: 'a', secret: 's' });
    const found = await orm.findByKeys([a.id]);
    // A date read through here must be a Date, not the column's string.
    expect(found.get(a.id)).toEqual(await orm.findById(a.id));
  });
});

// ── the dual: the rows that point at these keys ───────────────────────────────

describe('findAllByKeys — the other direction of a relation', () => {
  it('groups by the key each row points at, in one query', async () => {
    await orm.create({ title: 'a1', body: 'shared', secret: 's' });
    await orm.create({ title: 'a2', body: 'shared', secret: 's' });
    await orm.create({ title: 'b1', body: 'other', secret: 's' });

    const grouped = await orm.findAllByKeys('body', ['shared', 'other']);
    expect(grouped.get('shared')!.map((r: any) => r.title).sort()).toEqual(['a1', 'a2']);
    expect(grouped.get('other')!.map((r: any) => r.title)).toEqual(['b1']);
  });

  it('a key with no row is absent — never an empty array to be told apart', async () => {
    await orm.create({ title: 'a1', body: 'shared', secret: 's' });
    const grouped = await orm.findAllByKeys('body', ['shared', 'nobody']);
    expect(grouped.has('nobody')).toBe(false);
    expect((await orm.findAllByKeys('body', [])).size).toBe(0);
  });

  it('asks nothing outside the keys — the whole table is never the answer', async () => {
    await orm.create({ title: 'a1', body: 'shared', secret: 's' });
    await orm.create({ title: 'z', body: 'unasked', secret: 's' });
    const grouped = await orm.findAllByKeys('body', ['shared']);
    expect([...grouped.keys()]).toEqual(['shared']);
  });
});
