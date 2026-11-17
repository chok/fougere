import { describe, it, expect } from 'vitest';
import { entity, primary, text, unique, optional } from '@fougere/schema';
import { ErrorCode } from '@fougere/core';
import { createMemorySource, createMemoryStorage } from '../src/index.js';

class Author extends entity({
  id: primary(),
  email: unique(text()),
  nickname: optional(unique(text())),
}) {}

class Slot extends entity(
  { id: primary(), room: text(), hour: text() },
  { unique: [['room', 'hour']] },
) {}

const conflict = { code: ErrorCode.CONFLICT };

describe('a Map keeps unique the way a table does', () => {
  it('refuses a second row with the same value', async () => {
    const authors = createMemoryStorage(Author as never, 'author');
    await authors.create({ email: 'a@b.co' });

    await expect(authors.create({ email: 'a@b.co' })).rejects.toMatchObject(conflict);
  });

  it('refuses an update onto a value another row holds, and lets a row keep its own', async () => {
    const authors = createMemoryStorage(Author as never, 'author');
    const ada = await authors.create({ email: 'ada@b.co' }) as { id: string };
    await authors.create({ email: 'bob@b.co' });

    await expect(authors.update(ada.id, { email: 'bob@b.co' })).rejects.toMatchObject(conflict);
    await expect(authors.update(ada.id, { email: 'ada@b.co' })).resolves.toMatchObject({ email: 'ada@b.co' });
  });

  it('lets several rows leave an optional unique field empty', async () => {
    const authors = createMemoryStorage(Author as never, 'author');
    await authors.create({ email: 'a@b.co' });

    await expect(authors.create({ email: 'c@d.co' })).resolves.toBeDefined();
  });

  it('refuses a pair a group already holds, and accepts it with one member changed', async () => {
    const slots = createMemoryStorage(Slot as never, 'slot');
    await slots.create({ room: 'A', hour: '9' });

    await expect(slots.create({ room: 'A', hour: '9' })).rejects.toMatchObject(conflict);
    await expect(slots.create({ room: 'A', hour: '10' })).resolves.toBeDefined();
  });

  it('refuses a page that repeats a value inside itself', async () => {
    const authors = createMemoryStorage(Author as never, 'author');

    await expect(authors.createAll!([{ email: 'x@y.co' }, { email: 'x@y.co' }] as never)).rejects.toMatchObject(conflict);
    expect(await authors.list()).toHaveLength(0);
  });

  it('lets one of two writes arriving together through, never both', async () => {
    const authors = createMemoryStorage(Author as never, 'author');

    const settled = await Promise.allSettled([authors.create({ email: 'same@b.co' }), authors.create({ email: 'same@b.co' })]);

    expect(settled.map((one) => one.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  it('says so to the boot', () => {
    expect(createMemorySource().enforces).toContain('unique');
  });
});
