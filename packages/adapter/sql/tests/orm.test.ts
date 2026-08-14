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

// ── findByIds : une requête pour N clés ──────────────────────────────────────

describe('findByIds', () => {
  it('rend les lignes dans l’ordre DEMANDÉ, pas celui de la base', async () => {
    await orm.create({ title: 'un', body: 'a', secret: 's' });
    const b = await orm.create({ title: 'deux', body: 'b', secret: 's' });
    const c = await orm.create({ title: 'trois', body: 'c', secret: 's' });

    const rows = await orm.findByIds([c.id, b.id]);
    // Zipper une page contre le résultat n'a de sens que si l'ordre est celui demandé.
    expect(rows.map((r: any) => r.title)).toEqual(['trois', 'deux']);
  });

  it('une clé absente est absente — pas un trou, pas une erreur', async () => {
    const a = await orm.create({ title: 'un', body: 'a', secret: 's' });

    expect(await orm.findByIds([a.id, 'jamais-créé'])).toHaveLength(1);
    expect(await orm.findByIds([])).toEqual([]);
  });

  it('une clé répétée n’interroge qu’une fois et rend une ligne par demande', async () => {
    const a = await orm.create({ title: 'un', body: 'a', secret: 's' });
    // Le SELECT dédoublonne ; la réponse suit la demande.
    expect((await orm.findByIds([a.id, a.id])).map((r: any) => r.title)).toEqual(['un', 'un']);
  });

  it('les valeurs traversent le codec, comme par tout autre chemin de lecture', async () => {
    const a = await orm.create({ title: 'un', body: 'a', secret: 's' });
    const [row] = await orm.findByIds([a.id]);
    // Une date relue par ici doit être une Date, pas la chaîne de la colonne.
    expect(row).toEqual(await orm.findById(a.id));
  });
});
