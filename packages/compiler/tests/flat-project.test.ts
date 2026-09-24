import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer, type Container } from '@fougere/container';
import { createApp, createLocalRunner, Invocation, type Storage } from '@fougere/core';
import { scanProject } from '../src/index.js';

/** A stand-in for the per-entity storage, answering whatever a test hands it. */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const storage: Storage = {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
    findBy: vi.fn(async () => undefined),
    findAllBy: vi.fn(async () => []),
    findByKeys: vi.fn(async () => new Map()),
    findAllByKeys: vi.fn(async () => new Map()),
    upsert: vi.fn(async (i: any) => i),
    upsertAll: vi.fn(async (rows: any[]) => rows.length),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => true),
    client: undefined,
    output: () => storage,
    ...overrides,
  };

  return storage;
}

/**
 * The scan finding a root frond is one thing; the app hosting it is the claim. A flat
 * project gets its container scope, its per-entity storage and its façade like any other —
 * nothing downstream of the scan knows where the frond sat on disk.
 */
describe('createApp on a flat project', () => {
  const flatRoot = join(import.meta.dirname, 'fixtures-root-frond', 'shop');

  it('hosts the root frond and answers an operation', async () => {
    const storage = fakeStorage({ list: vi.fn(async () => [{ id: '1', name: 'Fern', price: 12.5 }]) });
    await using app = await createApp({ scan: await scanProject(flatRoot), createContainer, storageFactory: () => storage });

    expect(app.fronds.map((f) => f.name)).toEqual(['shop']);
    const scope = app.resolve<Container>('frond:shop');
    expect(scope.has('ProductStorage')).toBe(true);

    const run = createLocalRunner(app);
    const rows = await run({ entity: 'product', op: 'list' }, Invocation.empty);
    // Its own method, answering the storage's array: the envelope is `Crud.list`'s doing,
    // and an author writing the op keeps the shape they wrote.
    expect(rows).toEqual([{ id: '1', name: 'Fern', price: 12.5 }]);
  });
});
