/**
 * A realization may narrow the port, and the key does not move.
 *
 * An adapter hands back `Storage<T>` plus what its engine owns — the shape `SqlSource`
 * already has one level up, where `dialect`, `db` and `sink` are reached by narrowing. Below
 * it the door was shut: `depKeyOf` compared the type's name to `Storage` exactly, so a
 * constructor written `RankedStorage<Card>` asked the container for `'RankedStorage'` and the
 * boot refused. The subject is in the GENERIC, which is what this reads now.
 *
 * The suffix alone decides nothing, and must not: a provider class named `FileStorage` is an
 * ordinary service, and it carries no generic.
 */
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { scanProject } from '../src/node.js';
import { createApp, createLocalRunner } from '../src/index.js';
import { storageKeyOf, type StorageFactory } from '../src/storage.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

function makeStorage() {
  const storage = {
    list: vi.fn(async () => [] as unknown[]),
    findById: vi.fn(async () => undefined),
    findBy: vi.fn(async () => undefined),
    findAllBy: vi.fn(async () => [] as unknown[]),
    findByKeys: vi.fn(async () => new Map()),
    findAllByKeys: vi.fn(async () => new Map()),
    create: vi.fn(async (input: unknown) => input),
    upsert: vi.fn(async (input: unknown) => input),
    upsertAll: vi.fn(async () => 0),
    update: vi.fn(async (_id: string, input: unknown) => input),
    delete: vi.fn(async () => true),
    output: vi.fn(() => storage),
    client: {},
    // The gesture the frame cannot derive, and the reason a realization is narrowed at all.
    search: vi.fn(async () => ['c1', 'c2']),
  };
  return storage;
}

const storageFactory: StorageFactory = (() => makeStorage()) as unknown as StorageFactory;
const root = join(import.meta.dirname, 'fixtures-narrowed-storage');
const boot = async () =>
  createApp({ scan: await scanProject(root), createContainer, storageFactory });

describe('a realization narrowing the port', () => {
  it('asks for the storage of its generic, not for its own name', async () => {
    const scan = await scanProject(root);
    const repository = scan.fronds[0]!.providers.find((one) => one.ctor.name === 'CardRepository');

    expect(repository?.deps).toEqual([storageKeyOf('Card')]);
  });

  it('reaches the gesture the port does not have, through the door that owns it', async () => {
    await using app = await boot();

    const ranked = await createLocalRunner(app)({ entity: 'card', op: 'search' }, EMPTY_INVOCATION);

    expect(ranked).toEqual(['c1', 'c2']);
  });

  it('leaves a class whose name ends in the suffix alone — it carries no generic', async () => {
    const scan = await scanProject(root);
    const handler = scan.fronds[0]!.handlers.find((one) => one.ctor.name === 'CardHandler');

    expect(handler?.deps).toEqual(['CardRepository', 'FileStorage']);
  });
});
