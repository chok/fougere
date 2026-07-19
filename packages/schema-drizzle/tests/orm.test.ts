import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text, auto, updated } from '@fougere/schema';
import { DrizzleEntityOrm } from '../src/crud.js';

// ─── Fixtures ──────────────────────────────────

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  body: text(),
  secret: text(),
  createdAt: auto(),
  updatedAt: updated(),
}) {}

const PostPublic = Post.omit('secret');

/** Minimal mock Drizzle DB that returns rows from a provided store. */
function mockDb(rows: Record<string, unknown>[]) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: (resolve: Function) => resolve(rows),
  };
  return {
    select: vi.fn(() => chainable),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })) })),
  };
}

function createOrm(rows: Record<string, unknown>[]) {
  const db = mockDb(rows);
  return new DrizzleEntityOrm(db as any, Post, 'post');
}

// ─── Tests ─────────────────────────────────────

describe('EntityOrm.output()', () => {
  it('output() restricts fields on findById', async () => {
    const row = { id: '1', title: 'Hello', body: 'World', secret: 'hidden', createdAt: '2026-01-01' };
    const orm = createOrm([row]);

    const full = await orm.findById('1');
    expect(full).toHaveProperty('secret');

    const scoped = await orm.output(PostPublic).findById('1');
    expect(scoped).toBeDefined();
    expect(scoped).toHaveProperty('title', 'Hello');
    expect(scoped).toHaveProperty('body', 'World');
    expect(scoped).not.toHaveProperty('secret');
  });

  it('output() restricts fields on list', async () => {
    const rows = [
      { id: '1', title: 'A', body: 'B', secret: 's1', createdAt: '2026-01-01' },
      { id: '2', title: 'C', body: 'D', secret: 's2', createdAt: '2026-01-02' },
    ];
    const orm = createOrm(rows);

    const full = await orm.list();
    expect(full[0]).toHaveProperty('secret');

    const scoped = await orm.output(PostPublic).list();
    expect(scoped).toHaveLength(2);
    expect(scoped[0]).not.toHaveProperty('secret');
    expect(scoped[0]).toHaveProperty('title');
  });

  it('output() restricts fields on create', async () => {
    const orm = createOrm([]);
    const result = await orm.output(PostPublic).create({ title: 'X', body: 'Y', secret: 'z' });
    expect(result).toHaveProperty('title', 'X');
    expect(result).not.toHaveProperty('secret');
  });

  it('output() restricts fields on update', async () => {
    const row = { id: '1', title: 'New', body: 'B', secret: 's', createdAt: '2026-01-01' };
    const orm = createOrm([row]);
    const result = await orm.output(PostPublic).update('1', { title: 'New' });
    expect(result).toHaveProperty('title', 'New');
    expect(result).not.toHaveProperty('secret');
  });
});

describe('create()', () => {
  it('re-fetches the inserted row — rules realised by SQL appear in the result', async () => {
    // The store simulates the row AFTER insert: `active` was filled by its
    // SQL DEFAULT, absent from the input. Contract: create returns the
    // complete row (validation judges absence, storage realises).
    const row = { id: '1', title: 'Hello', body: 'B', secret: 's', createdAt: '2026-01-01', active: true };
    const orm = createOrm([row]);
    const result = await orm.create({ id: '1', title: 'Hello', body: 'B', secret: 's' });
    expect(result).toEqual(row);
  });

  it('falls back to the stamped input when the row cannot be re-fetched', async () => {
    const orm = createOrm([]);
    const result = await orm.create({ title: 'X', body: 'B', secret: 's' });
    expect(result).toHaveProperty('title', 'X');
    expect(result).toHaveProperty('id'); // { generate } stamped applicatively
    expect(result).toHaveProperty('createdAt'); // 'now' stamped applicatively
  });
});

describe('update()', () => {
  it("stamps `update: 'now'` fields when absent — a supplied value is accepted", async () => {
    const db = mockDb([]);
    const orm = new DrizzleEntityOrm(db as any, Post, 'post');

    await orm.update('1', { title: 'New' });
    const stamped = db.update.mock.results[0].value.set.mock.calls[0][0];
    expect(stamped.title).toBe('New');
    expect(typeof stamped.updatedAt).toBe('string'); // realised at update
    expect('createdAt' in stamped).toBe(false); // create-side rule, untouched here

    await orm.update('1', { title: 'X', updatedAt: '2020-01-01T00:00:00.000Z' });
    const supplied = db.update.mock.results[1].value.set.mock.calls[0][0];
    expect(supplied.updatedAt).toBe('2020-01-01T00:00:00.000Z'); // accepted, not overwritten
  });
});

describe('select option', () => {
  it('findById with select option restricts fields', async () => {
    const row = { id: '1', title: 'Hello', body: 'World', secret: 'hidden', createdAt: '2026-01-01' };
    const orm = createOrm([row]);

    const scoped = await orm.findById('1', { select: PostPublic });
    expect(scoped).toHaveProperty('title', 'Hello');
    expect(scoped).not.toHaveProperty('secret');
  });

  it('list with select option restricts fields', async () => {
    const rows = [{ id: '1', title: 'A', body: 'B', secret: 's1', createdAt: '2026-01-01' }];
    const orm = createOrm(rows);

    const scoped = await orm.list({ select: PostPublic });
    expect(scoped[0]).not.toHaveProperty('secret');
    expect(scoped[0]).toHaveProperty('title');
  });
});
