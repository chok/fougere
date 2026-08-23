import { number, text } from '@fougere/schema';
import { describe, expect, it, vi } from 'vitest';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';

describe('StorageGuard', () => {
  const fields = { name: text(), stock: number({ min: 0 }) };

  it('forwards valid writes without changing the ORM interface', async () => {
    const orm = {
      marker: 'orm',
      create: vi.fn(async (input: object) => input),
      update: vi.fn(async (_id: string, input: object) => input),
      list: vi.fn(async () => []),
    };
    const guarded = new StorageGuard(fields, 'product').guard(orm);

    await expect(guarded.create({ name: 'Fern', stock: 2 })).resolves
      .toEqual({ name: 'Fern', stock: 2 });
    expect(guarded.marker).toBe('orm');
  });

  it('rejects invalid domain output on the promise boundary', async () => {
    const create = vi.fn(async (input: object) => input);
    const guarded = new StorageGuard(fields, 'product').guard({
      create,
      update: vi.fn(async (_id: string, input: object) => input),
    });

    await expect(guarded.create({ name: 'Fern', stock: -1 }))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        entity: 'product',
        operation: 'create',
      });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects unknown list options instead of widening the query', async () => {
    const list = vi.fn(async (_options?: object) => []);
    const guarded = new StorageGuard(fields, 'product').guard({
      create: vi.fn(),
      update: vi.fn(),
      list,
    });

    await expect(guarded.list({ categoryId: 'c1' }))
      .rejects.toThrow(/unknown option `categoryId`/);
    expect(list).not.toHaveBeenCalled();
  });
});
