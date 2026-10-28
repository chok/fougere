/**
 * Two fronds declaring an `Author` in one source are two views of ONE table: it is built from their
 * union, and each view writes and reads its own columns — the other's never reaches it.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { sourceViewOf } from '@fougere/core';
import { createSqliteSource } from '../src/sqlite/SqliteSource.js';
import { migrate } from '../src/diff/Change.js';
import { actualState } from '../src/diff/SchemaState.js';

const named = <T extends abstract new (...args: never[]) => unknown>(ctor: T): T => Object.defineProperty(ctor, 'name', { value: 'Author' });
const BlogAuthor = named(class extends entity({ id: primary(), name: text(), pen: text() }) {});
const ShopAuthor = named(class extends entity({ id: primary(), name: text(), vat: text() }) {});

describe('one table, two views', () => {
  it('holds the union, and each view answers only what it declares', async () => {
    const source = createSqliteSource({ path: ':memory:' });
    const fronds = [
      { name: 'blog', entities: [{ name: 'author', entityClass: BlogAuthor }] },
      { name: 'shop', entities: [{ name: 'author', entityClass: ShopAuthor }] },
    ];
    await migrate(sourceViewOf(fronds), source.db);
    const columns = [...(await actualState(source.db)).get('authors')!].sort();
    const blog = source.storageFactory(BlogAuthor as never, 'author');
    const shop = source.storageFactory(ShopAuthor as never, 'author');

    await blog.create({ id: 'a1', name: 'Ada', pen: 'A.L.' } as never);
    await shop.create({ id: 'a2', name: 'Bob', vat: 'FR1' } as never);

    expect(columns).toEqual(['id', 'name', 'pen', 'vat']);
    expect(await blog.findById('a2')).toEqual({ id: 'a2', name: 'Bob', pen: null });
    expect(await shop.findById('a1')).toEqual({ id: 'a1', name: 'Ada', vat: null });
  });
});
