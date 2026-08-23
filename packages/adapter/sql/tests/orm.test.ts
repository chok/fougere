/**
 * The ORM against a real SQLite database — not a mock.
 *
 * The whole chain is exercised: DDL from the entity, Kysely's SQL, the
 * field↔column mapping, and the lifecycle rules realised on write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, bool, created, updated, optional } from '@fougere/schema';
import { autoMigrate, codecFor } from '../src/index.js';
import { setupSqlite, type SqliteSetup } from '../src/sqlite.js';

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

// ── a driver that answers a BigInt ────────────────────────────────────────────

describe('a number the driver hands back as a BigInt', () => {
  it('comes back a number, because that is what the field declares', () => {
    // Postgres does it for `count(*)` and for `bigint` columns, DuckDB for every count.
    // Untouched, the value does not even leave: `JSON.stringify` refuses a BigInt.
    const codec = codecFor({ type: 'integer' });
    expect(codec.read(42n)).toBe(42);
    expect(typeof codec.read(42n)).toBe('number');
    expect(JSON.stringify({ n: codec.read(42n) })).toBe('{"n":42}');
  });

  it('refuses one too large rather than rounding it', () => {
    // Number(9007199254740993n) is 9007199254740992 — a wrong answer, silently.
    expect(() => codecFor({ type: 'integer' }).read(9007199254740993n))
      .toThrow(/does not fit a JavaScript number/);
  });

  it('leaves a plain number and a null alone', () => {
    const codec = codecFor({ type: 'number' });
    expect(codec.read(1.5)).toBe(1.5);
    expect(codec.read(null)).toBeNull();
    expect(codec.read(undefined)).toBeUndefined();
  });
});

// ── more keys than the engine can bind ────────────────────────────────────────

/**
 * A key set comes from a PAGE, and `list()` with no limit reads the table — so the
 * set has no ceiling while the engine does. Measured on better-sqlite3: 32 766 binds
 * pass, 32 767 answers `too many SQL variables`. SQL Server is the low one at 2100.
 *
 * A batch read that dies at a certain data size is the worst kind: it works in dev.
 */
describe('a key set larger than one statement can bind', () => {
  const MANY = 40_000;

  beforeEach(async () => {
    // Fifty real rows; the rest of the keys match nothing, which is the ordinary case
    // (a page of foreign keys pointing at a table that holds far fewer of them).
    for (let i = 0; i < 50; i++) await orm.create({ title: `t${i}`, body: 'b', secret: 's' });
  });

  it('reads them all — sliced, and the caller never learns there were several', async () => {
    const real = (await orm.list()).map((r: any) => r.id);
    const keys = [...real, ...Array.from({ length: MANY }, (_, i) => `absent-${i}`)];

    const found = await orm.findByKeys(keys);
    expect(found.size).toBe(50);
    expect(found.get(real[0])!.title).toBe('t0');
  });

  it('groups them all on the dual, slices concatenated', async () => {
    const keys = ['b', ...Array.from({ length: MANY }, (_, i) => `absent-${i}`)];
    const grouped = await orm.findAllByKeys('body', keys);
    expect(grouped.get('b')).toHaveLength(50);
  });

  it('refuses on `list`, naming the gesture that handles it', async () => {
    // A limit and an order do not recompose across statements, so this one cannot be
    // split — and truncating in silence would be the failure this whole test exists for.
    const keys = Array.from({ length: MANY }, (_, i) => `k${i}`);
    await expect(orm.list({ where: { id: keys } }))
      .rejects.toThrow(/binds 30000 — a page and an order cannot be split.*findAllByKeys/s);
  });

  it('refuses two oversized criteria rather than guessing their cross product', async () => {
    const keys = Array.from({ length: MANY }, (_, i) => `k${i}`);
    await expect(orm.findAllBy({ id: keys, title: keys }))
      .rejects.toThrow(/each hold more than 30000 values/);
  });
});

// ── upsert : écrire, ou remplacer ce qui est là ───────────────────────────────

describe('upsert', () => {
  it('writes when the row is absent, exactly like create', async () => {
    const row = await orm.upsert({ id: 'p1', title: 'first', body: 'b', secret: 's' });
    expect(row.title).toBe('first');
    // The lifecycle a first write owes is realized: a declared default, a stamp.
    expect(row.views).toBe(0);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('replaces when it is there — the second run of an import must not throw', async () => {
    await orm.upsert({ id: 'p1', title: 'first', body: 'b', secret: 's' });
    const again = await orm.upsert({ id: 'p1', title: 'revised', body: 'b2', secret: 's' });

    expect(again.title).toBe('revised');
    expect(again.body).toBe('b2');
    expect(await orm.list()).toHaveLength(1);
  });

  it('keeps the moment the row appeared, whatever a later write says', async () => {
    const first = await orm.upsert({ id: 'p1', title: 'first', body: 'b', secret: 's' });
    await new Promise((r) => setTimeout(r, 5));
    const again = await orm.upsert({ id: 'p1', title: 'revised', body: 'b', secret: 's' });

    // A row keeps its creation stamp — replacing it would erase when it appeared.
    expect(again.createdAt).toEqual(first.createdAt);
    // And it carries when it last changed.
    expect(new Date(again.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime());
  });

  it('generates the key when the caller brings none', async () => {
    const row = await orm.upsert({ title: 'no key of mine', body: 'b', secret: 's' });
    expect(row.id).toMatch(/.+/);
  });
});

// ── upsertAll : une page, une écriture ────────────────────────────────────────

describe('upsertAll', () => {
  it('writes a page in one statement, and says how many', async () => {
    const page = Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, title: `t${i}`, body: 'b', secret: 's' }));
    expect(await orm.upsertAll(page)).toBe(200);
    expect(await orm.list()).toHaveLength(200);
  });

  it('replaces on a second pass — the shape of a re-import', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, title: `t${i}`, body: 'b', secret: 's' }));
    await orm.upsertAll(page);
    await orm.upsertAll(page.map((r) => ({ ...r, title: `${r.title} révisé` })));

    expect(await orm.list()).toHaveLength(50);
    expect((await orm.findById('p0')).title).toBe('t0 révisé');
  });

  it('slices by rows × COLUMNS — a statement binds values, not rows', async () => {
    // 9 columns each: 30000 bindings is ~3300 rows per statement, so this spans several.
    const many = Array.from({ length: 8_000 }, (_, i) => ({ id: `p${i}`, title: `t${i}`, body: 'b', secret: 's' }));
    expect(await orm.upsertAll(many)).toBe(8_000);
    expect(await orm.list()).toHaveLength(8_000);
  });

  it('keeps the moment each row appeared', async () => {
    await orm.upsertAll([{ id: 'p1', title: 'first', body: 'b', secret: 's' }]);
    const first = await orm.findById('p1');
    await new Promise((r) => setTimeout(r, 5));
    await orm.upsertAll([{ id: 'p1', title: 'revised', body: 'b', secret: 's' }]);
    const again = await orm.findById('p1');

    expect(again.createdAt).toEqual(first.createdAt);
    expect(new Date(again.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime());
  });

  it('writes nothing for an empty page', async () => {
    expect(await orm.upsertAll([])).toBe(0);
  });
});
