import { Boundaries, date, number, primary, text } from '@fougere/schema';
import { describe, expect, it, vi } from 'vitest';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';
import { storageOver, type Store, type Values } from '../src/storage/store.js';

describe('StorageGuard', () => {
  const fields = { name: text(), stock: number({ min: 0 }) };

  it('forwards valid writes without changing the storage interface', async () => {
    const storage = {
      marker: 'storage',
      create: vi.fn(async (input: object) => input),
      update: vi.fn(async (_id: string, input: object) => input),
      list: vi.fn(async () => []),
    };
    const guarded = new StorageGuard(fields, 'product').guard(storage);

    await expect(guarded.create({ name: 'Fern', stock: 2 })).resolves
      .toEqual({ name: 'Fern', stock: 2 });
    expect(guarded.marker).toBe('storage');
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

  it('covers upsert, which writes the same rows through another name', async () => {
    const upsert = vi.fn(async (input: object) => input);
    const guarded = new StorageGuard(fields, 'product').guard({
      create: vi.fn(),
      update: vi.fn(),
      upsert,
    });

    await expect(guarded.upsert({ name: 'Fern', stock: -1 }))
      .rejects.toMatchObject({ operation: 'upsert' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('validates a whole page before the first row of it is written', async () => {
    const upsertAll = vi.fn(async (rows: readonly object[]) => rows.length);
    const guarded = new StorageGuard(fields, 'product').guard({
      create: vi.fn(),
      update: vi.fn(),
      upsertAll,
    });

    await expect(guarded.upsertAll([{ name: 'Fern', stock: 1 }, { name: 'Moss', stock: -1 }]))
      .rejects.toThrow(/row 1 of this page — stock/);
    expect(upsertAll).not.toHaveBeenCalled();
  });

  it('hands the storage the value it PARSED, the way the client door does', async () => {
    const create = vi.fn(async (input: object) => input);
    const guarded = new StorageGuard({ ...fields, at: date() }, 'product').guard({
      create,
      update: vi.fn(),
    });

    await guarded.create({ name: 'Fern', stock: 1, at: '2026-09-05T00:00:00.000Z' });

    expect(create.mock.calls[0]![0]).toEqual({
      name: 'Fern',
      stock: 1,
      at: new Date('2026-09-05T00:00:00.000Z'),
    });
  });

  it('judges a row once, whatever the gesture it arrived by', async () => {
    let decoded = 0;
    Boundaries.decoders.register('guardCents', (value) => {
      decoded += 1;
      return { value: Number(value) / 100 };
    });
    const rows = new Map<string, Values>();
    const store: Store = {
      get: async (key) => rows.get(key),
      has: async (key) => rows.has(key),
      set: async (key, values) => { rows.set(key, values); },
      delete: async (key) => rows.delete(key),
      all: async () => [...rows.values()],
      client: rows,
    };
    const priced = {
      id: primary(),
      amount: number().with({ boundary: { in: { decode: 'guardCents' } } }),
    };
    const storage = storageOver(() => store)({ getFields: () => priced } as never, 'money');
    const guarded = new StorageGuard(priced, 'money').guard(storage);

    await guarded.upsertAll([{ id: 'a', amount: 10000 }]);

    expect(decoded).toBe(1);
    expect(rows.get('a')?.amount).toBe(100);
  });
});
