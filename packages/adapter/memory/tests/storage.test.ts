/**
 * The store an app with no `db` runs on.
 *
 * It used to ignore its entity entirely — forcing the field name `id`, minting a uuid
 * whatever was declared, realizing none of the lifecycle rules. It reads the axes now,
 * which is what these tests hold; and reading them raised a case the old version hid.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, created } from '@fougere/schema';
import { createMemoryStorage } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  status: oneOf('draft', 'published', { default: 'draft' }),
  createdAt: created(),
}) {}

/** The caller supplies the key — `primary(field)` adds no create rule. */
class Sku extends entity({ code: primary(text()), label: text() }) {}

describe('the fallback store realizes what the entity declares', () => {
  it('generates the id, stamps the timestamp, applies the default', async () => {
    const storage = createMemoryStorage(Post as never, 'post');
    const row = await storage.create({ title: 'Hello' }) as Record<string, unknown>;

    expect(row.id).toEqual(expect.any(String));
    expect(row.status).toBe('draft');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(await storage.findById(row.id as string)).toEqual(row);
  });

  it('keys on the entity\'s own primary, whatever it is called', async () => {
    const storage = createMemoryStorage(Sku as never, 'sku');
    const row = await storage.create({ code: 'CHAIR-1', label: 'A chair' }) as Record<string, unknown>;

    // Not `id`: the old version invented that field and keyed on it, so an entity whose
    // key is named anything else was stored under a name it never declared.
    expect('id' in row).toBe(false);
    expect(await storage.findById('CHAIR-1')).toEqual(row);
  });

  it('refuses a row with no key rather than storing rows on top of each other', async () => {
    const storage = createMemoryStorage(Sku as never, 'sku');

    // `primary(text())` declares no generator, so nothing fills the hole. Storing under
    // `undefined` would make the SECOND create overwrite the first, in silence.
    await expect(storage.create({ label: 'A chair' })).rejects.toThrow(/'code'/);
  });

  it('refuses a duplicate key — a create is not an upsert', async () => {
    const storage = createMemoryStorage(Sku as never, 'sku');
    await storage.create({ code: 'A', label: 'first' });

    // `Map.set` overwrites. SQL answers this with a constraint violation; a store that
    // answers "created" while destroying the previous row is worse than one that fails.
    await expect(storage.create({ code: 'A', label: 'second' })).rejects.toThrow(/already/i);
    expect(await storage.list()).toHaveLength(1);
  });

  it('finds a non-string key by the string the port promises', async () => {
    // `Storage.findById(id: string)` — a numeric key is stored under a number by a
    // Map, so `findById('1')` missed a row `findById(1)` found. SQL never had the
    // problem; the divergence was silent and only on this storage.
    class Counter extends entity({ seq: primary(number({ integer: true })), label: text() }) {}
    const storage = createMemoryStorage(Counter as never, 'counter');
    const row = await storage.create({ seq: 1, label: 'x' });

    expect(await storage.findById('1')).toEqual(row);
    expect(await storage.findById(1 as never)).toEqual(row);
  });
});

/**
 * `where` and `count` answer the same page, and used to disagree.
 *
 * The filter narrowed the rows; the total read `store.size`, which is every row
 * the store holds. So a paginator computed its page count from a number the
 * caller was never allowed to see — and on a filter that scopes a tenant, the
 * total published the other tenant's volume.
 */
describe('a filtered list counts what it filtered', () => {
  class Tenanted extends entity({ id: primary(), tenant: text() }) {}

  it('totals the matching rows, not the whole store', async () => {
    const storage = createMemoryStorage(Tenanted as never, 'tenanted');
    await storage.create({ tenant: 'A' });
    await storage.create({ tenant: 'A' });
    await storage.create({ tenant: 'B' });

    const page = await storage.list({ where: { tenant: 'A' }, count: true });
    expect(page.length).toBe(2);
    expect(page.total).toBe(2);
  });

  it('counts the matching rows even when the page is smaller', async () => {
    const storage = createMemoryStorage(Tenanted as never, 'tenanted');
    for (const tenant of ['A', 'A', 'A', 'B']) await storage.create({ tenant });

    const page = await storage.list({ where: { tenant: 'A' }, limit: 2, count: true });
    expect(page.length).toBe(2);
    expect(page.total).toBe(3);
  });
});

describe('output(schema)', () => {
  it('restricts every read to the fields of the view, the way SQL selects them', async () => {
    const storage = createMemoryStorage(Post as never, 'post');
    await storage.create({ title: 'Fern', status: 'published' });
    const scoped = storage.output(Post.pick('id', 'title') as never);

    const [listed] = await scoped.list({});
    expect(Object.keys(listed as object).sort()).toEqual(['id', 'title']);
    expect(Object.keys(await scoped.findById((listed as any).id) as object).sort())
      .toEqual(['id', 'title']);
    // The unscoped one still answers whole: the view is a way of reading, not a deletion.
    expect(await storage.findById((listed as any).id)).toHaveProperty('status', 'published');
  });

  it('pages on a key the view does not show', async () => {
    const storage = createMemoryStorage(Post as never, 'post');
    await storage.create({ title: 'A' });
    const page = await storage.output(Post.pick('title') as never).list({ limit: 1 });

    expect(page.endCursor).toBeDefined();
    expect(Object.keys(page[0] as object)).toEqual(['title']);
  });
});
