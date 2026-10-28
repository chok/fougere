/**
 * The framework's own ports, and the one thing that makes them different from a port.
 *
 * A port's realization is SCANNED — `class StripePayment extends Payment` — so a class
 * extending it may be either the realization or a wrapper, and the boot tells them apart by
 * whether it asks for the port. A seam's realization is HANDED IN: `storageFactory` builds
 * one per entity and no class declares it, so a class extending a seam can only stand in
 * front of it. Everything else is the same key, the same order, the same refusals.
 */
import shop from './fixtures-seam-storage/fronds.js';
import familyFronds from './fixtures-seam-family/fronds.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createAppRunner, createLocalRunner, frond, Invocation, togetherKeyOf, type FrondEntries, type Storage, type StorageFactory } from '../src/index.js';
import type { Container } from '@fougere/container';
import Product from './fixtures-seam-storage/fronds/shop/entities/Product.js';
import ProductHandler from './fixtures-seam-storage/fronds/shop/handlers/ProductHandler.js';
import ProductRepository from './fixtures-seam-storage/fronds/shop/repositories/ProductRepository.js';
import Counting from './fixtures-seam-storage/fronds/shop/services/Counting.js';
import { op, param } from './contract.js';

/** `ledger` holds a link and answers nothing; `warehouse` declares none and sits under it. */

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
  fronds: shop,
  createContainer,
  storageFactory,
  ...(ports ? { ports } : {}),
});

describe('a class that stands in front of a seam', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__wrote = []; });

  it('is in front of the storage, declared nowhere but in its own signature', async () => {
    await using built = await app();

    await createLocalRunner(built)({ address: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'fern' } });

    // `Counting` names no entity and no frond: it extends `Storage` and asks for one.
    expect(wrote()).toEqual(['counting(fern)']);
  });

  it('leaves the twelve gestures it says nothing about to the storage underneath', async () => {
    await using built = await app();
    const call = createLocalRunner(built);

    await call({ address: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'moss' } });
    const rows = await call({ address: 'product', op: 'list' }, Invocation.empty) as { items: unknown[] };

    // `list` is not on the wrapper. It reaches the realization through the base's forwards,
    // which is what lets a wrapper be three lines instead of thirteen.
    expect(rows.items).toHaveLength(1);
  });

  it('is never reached by a row the entity refuses', async () => {
    await using built = await app();

    // The guard stands OUTSIDE the chain, so a link reads what the entity says a row is —
    // and a refused one never gets there at all.
    await expect(
      createLocalRunner(built)({ address: 'product', op: 'add' }, { ...Invocation.empty, params: { title: '' } }),
    ).rejects.toThrow(/title/);
    expect(wrote()).toEqual([]);
  });

  it('is named in `ports:` like any other chain', async () => {
    await using built = await app({ Storage: ['Counting'] });

    await createLocalRunner(built)({ address: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'ivy' } });

    expect(wrote()).toEqual(['counting(ivy)']);
  });

  it('leaves the neighbour\'s rows alone — the scope is the frond', async () => {
    await using built = await app();

    // A link goes where its FROND goes, which is what preserves the gradient: `warehouse`
    // moved behind `remotes:` would not silently lose one its own code never mentioned. A
    // link that must be everywhere is a frond that is everywhere (`Extension.fronds`).
    await createLocalRunner(built)({ address: 'crate', op: 'add' }, { ...Invocation.empty, params: { label: 'oak' } });

    expect(wrote()).toEqual([]);
  });

  it('refuses a `ports:` entry naming a class that stands in front of nothing', async () => {
    await expect(app({ Storage: ['Absent'] }))
      .rejects.toThrow(/\[port-not-extended\][\s\S]*No class Absent extends or implements Storage/);
  });
});

describe('a link declared by the frond above', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__wrote = []; });

  const family = (under?: FrondEntries) => createApp({
    fronds: familyFronds,
    createContainer,
    storageFactory,
    ...(under ? { under } : {}),
  });

  it('stands in front of the rows of every frond under it', async () => {
    await using built = await family({ warehouse: { extends: 'ledger' } });

    await createLocalRunner(built)({ address: 'crate', op: 'add' }, { ...Invocation.empty, params: { label: 'oak' } });

    // A seam has no container key — its realization is built, not resolved — so inheriting a
    // link is a list carried down, the same shape a middleware needed.
    expect(wrote()).toEqual(['stamping(oak)']);
  });

  it('reaches nothing while the two fronds are only neighbours', async () => {
    await using built = await family();

    await createLocalRunner(built)({ address: 'crate', op: 'add' }, { ...Invocation.empty, params: { label: 'ash' } });

    expect(wrote()).toEqual([]);
  });
});

describe('every way a frond builds its rows', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__wrote = []; });

  const framed = togetherKeyOf(['product']);
  class Restocking {}
  const shopWithEveryWay = [frond('shop', {
    entities: [Product],
    providers: [{ ctor: Counting, deps: ['Storage'] }, { ctor: ProductRepository, repository: Product }],
    handlers: [
      { ctor: Restocking, deps: [framed] },
      {
        ctor: ProductHandler,
        deps: ['ProductRepository'],
        surface: 'admin',
        operations: { add: op({ args: [param('title')], cardinality: 'none', description: 'Write one row.' }) },
      },
    ],
  })];

  it('puts the link in front of a named surface', async () => {
    await using built = await createApp({ fronds: shopWithEveryWay, createContainer, storageFactory });

    await createAppRunner(built, 'admin')({ address: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'fern' } });

    expect(wrote()).toEqual(['counting(fern)']);
  });

  it('puts the link in front of a frame', async () => {
    await using built = await createApp({ fronds: shopWithEveryWay, createContainer, storageFactory });
    const frame = built.container.resolve<Container>('frond:shop')
      .resolve<{ run(fn: (storages: Storage[]) => Promise<unknown>): Promise<unknown> }>(framed);

    await frame.run(([products]) => products!.create({ id: 'moss', title: 'moss' }));

    expect(wrote()).toEqual(['counting(moss)']);
  });
});
