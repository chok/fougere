/**
 * The store an app with no `db` runs on.
 *
 * It used to ignore its entity entirely — forcing the field name `id`, minting a uuid
 * whatever was declared, realizing none of the lifecycle rules. It reads the axes now,
 * which is what these tests hold; and reading them raised a case the old version hid.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, created } from '@fougere/schema';
import { createMemoryOrm } from '../src/boot.js';

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
    const orm = createMemoryOrm(Post as never, 'post');
    const row = await orm.create({ title: 'Hello' }) as Record<string, unknown>;

    expect(row.id).toEqual(expect.any(String));
    expect(row.status).toBe('draft');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(await orm.findById(row.id as string)).toEqual(row);
  });

  it('keys on the entity\'s own primary, whatever it is called', async () => {
    const orm = createMemoryOrm(Sku as never, 'sku');
    const row = await orm.create({ code: 'CHAIR-1', label: 'A chair' }) as Record<string, unknown>;

    // Not `id`: the old version invented that field and keyed on it, so an entity whose
    // key is named anything else was stored under a name it never declared.
    expect('id' in row).toBe(false);
    expect(await orm.findById('CHAIR-1')).toEqual(row);
  });

  it('refuses a row with no key rather than storing rows on top of each other', async () => {
    const orm = createMemoryOrm(Sku as never, 'sku');

    // `primary(text())` declares no generator, so nothing fills the hole. Storing under
    // `undefined` would make the SECOND create overwrite the first, in silence.
    await expect(orm.create({ label: 'A chair' })).rejects.toThrow(/'code'/);
  });

  it('refuses a duplicate key — a create is not an upsert', async () => {
    const orm = createMemoryOrm(Sku as never, 'sku');
    await orm.create({ code: 'A', label: 'first' });

    // `Map.set` overwrites. SQL answers this with a constraint violation; a store that
    // answers "created" while destroying the previous row is worse than one that fails.
    await expect(orm.create({ code: 'A', label: 'second' })).rejects.toThrow(/already/i);
    expect(await orm.list()).toHaveLength(1);
  });

  it('finds a non-string key by the string the port promises', async () => {
    // `EntityOrm.findById(id: string)` — a numeric key is stored under a number by a
    // Map, so `findById('1')` missed a row `findById(1)` found. SQL never had the
    // problem; the divergence was silent and only on this storage.
    class Counter extends entity({ seq: primary(number({ integer: true })), label: text() }) {}
    const orm = createMemoryOrm(Counter as never, 'counter');
    const row = await orm.create({ seq: 1, label: 'x' });

    expect(await orm.findById('1')).toEqual(row);
    expect(await orm.findById(1 as never)).toEqual(row);
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
  class Row extends entity({ id: primary(), tenant: text() }) {}

  it('totals the matching rows, not the whole store', async () => {
    const orm = createMemoryOrm(Row as never, 'row');
    await orm.create({ tenant: 'A' });
    await orm.create({ tenant: 'A' });
    await orm.create({ tenant: 'B' });

    const page = await orm.list({ where: { tenant: 'A' }, count: true });
    expect(page.length).toBe(2);
    expect(page.total).toBe(2);
  });

  it('counts the matching rows even when the page is smaller', async () => {
    const orm = createMemoryOrm(Row as never, 'row');
    for (const tenant of ['A', 'A', 'A', 'B']) await orm.create({ tenant });

    const page = await orm.list({ where: { tenant: 'A' }, limit: 2, count: true });
    expect(page.length).toBe(2);
    expect(page.total).toBe(3);
  });
});
