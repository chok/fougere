/** Two fronds declaring `Author` in one memory source share its rows, each view reading its own fields. */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { createMemorySource } from '../src/index.js';

const named = <T extends abstract new (...args: never[]) => unknown>(ctor: T): T => Object.defineProperty(ctor, 'name', { value: 'Author' });
const BlogAuthor = named(class extends entity({ id: primary(), name: text(), pen: text() }) {});
const ShopAuthor = named(class extends entity({ id: primary(), name: text(), vat: text() }) {});

describe('one memory source, two views of Author', () => {
  it('shares the rows by name, and answers each view its own fields', async () => {
    const { storageFactory } = createMemorySource();
    const blog = storageFactory(BlogAuthor as never, 'author');
    const shop = storageFactory(ShopAuthor as never, 'author');

    await blog.create({ id: 'a1', name: 'Ada', pen: 'A.L.' } as never);
    await shop.update('a1', { vat: 'FR1' } as never);

    expect(await blog.findById('a1')).toEqual({ id: 'a1', name: 'Ada', pen: 'A.L.' });
    expect(await shop.findById('a1')).toEqual({ id: 'a1', name: 'Ada', vat: 'FR1' });
  });
});
