/**
 * The framework's own ports, and the one thing that makes them different from a port.
 *
 * A port's realization is SCANNED — `class StripePayment extends Payment` — so a class
 * extending it may be either the realization or a wrapper, and the boot tells them apart by
 * whether it asks for the port. A seam's realization is HANDED IN: `storageFactory` builds
 * one per entity and no class declares it, so a class extending a seam can only stand in
 * front of it. Everything else is the same key, the same order, the same refusals.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Invocation, type StorageFactory } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-seam-storage');

const wrote = () => ((globalThis as Record<string, unknown>).__wrote ?? []) as string[];

/** The realization, handed in — which is the one way a seam differs from a port. */
const storageFactory: StorageFactory = (() => {
  const rows: Record<string, unknown>[] = [];
  const storage = {
    async list() { return { items: [...rows], total: rows.length }; },
    async findById() { return undefined; },
    async findBy() { return undefined; },
    async findAllBy() { return []; },
    async findByKeys() { return new Map(); },
    async findAllByKeys() { return new Map(); },
    async create(input: Record<string, unknown>) { rows.push(input); return input; },
    async upsert(input: Record<string, unknown>) { return input; },
    async upsertAll() { return 0; },
    async update(_id: string, input: Record<string, unknown>) { return input; },
    async delete() { return true; },
    output() { return storage; },
    client: {},
  };

  return storage;
}) as unknown as StorageFactory;

const app = (ports?: Record<string, string | readonly string[]>) => createApp({
  scan: () => scanProject(root),
  createContainer,
  storageFactory,
  ...(ports ? { ports } : {}),
});

describe('a class that stands in front of a seam', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__wrote = []; });

  it('is in front of the storage, declared nowhere but in its own signature', async () => {
    await using built = await app();

    await createLocalRunner(built)({ entity: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'fern' } });

    // `Counting` names no entity and no frond: it extends `Storage` and asks for one.
    expect(wrote()).toEqual(['counting(fern)']);
  });

  it('leaves the twelve gestures it says nothing about to the storage underneath', async () => {
    await using built = await app();
    const call = createLocalRunner(built);

    await call({ entity: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'moss' } });
    const rows = await call({ entity: 'product', op: 'list' }, Invocation.empty) as { items: unknown[] };

    // `list` is not on the wrapper. It reaches the realization through the base's forwards,
    // which is what lets a wrapper be three lines instead of thirteen.
    expect(rows.items).toHaveLength(1);
  });

  it('is never reached by a row the entity refuses', async () => {
    await using built = await app();

    // The guard stands OUTSIDE the chain, so a link reads what the entity says a row is —
    // and a refused one never gets there at all.
    await expect(
      createLocalRunner(built)({ entity: 'product', op: 'add' }, { ...Invocation.empty, params: { title: '' } }),
    ).rejects.toThrow(/title/);
    expect(wrote()).toEqual([]);
  });

  it('is named in `ports:` like any other chain', async () => {
    await using built = await app({ Storage: ['Counting'] });

    await createLocalRunner(built)({ entity: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'ivy' } });

    expect(wrote()).toEqual(['counting(ivy)']);
  });

  it('refuses a `ports:` entry naming a class that stands in front of nothing', async () => {
    await expect(app({ Storage: ['Absent'] }))
      .rejects.toThrow(/\[ports\] Storage: 'Absent' does not extend it/);
  });
});
