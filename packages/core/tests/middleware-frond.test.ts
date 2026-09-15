/**
 * A middleware declared IN a frond — the tenth convention directory, and the only one whose
 * members apply to code they do not name. What RUNS one is `middleware.test.ts`, beside it.
 *
 * `app.use()` was the only way in, which made a middleware the host's to state: a frond that
 * wanted to wrap its own calls had nowhere to say so. What the tests hold is the reach — a
 * middleware answers for its own frond and for the fronds under it, and where it sits in
 * `FougereConfig.fronds` is the only thing that says how far that goes.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Invocation, type StorageFactory } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware');

/** The fixtures push here — see Trail for why it is not a module-level array. */
const around = () => ((globalThis as Record<string, unknown>).__around ?? []) as string[];

/** Rows in a Map: this is about what runs around a call, not about where data lives. */
const memory: StorageFactory = () => {
  const rows = new Map<string, Record<string, unknown>>();

  return {
    async list() { return [...rows.values()]; },
    async findById(id: string) { return rows.get(id); },
    async create(input: Record<string, unknown>) {
      rows.set(String(input.id), input);
      return input;
    },
    async update() { throw new Error('not exercised'); },
    async delete() { return false; },
    output() { return this; },
  } as never;
};

/** `ops` serves nothing and holds `Everywhere`; the two that serve sit under it. */
const family = { ops: { shop: {}, mail: {} } };

const app = (under?: typeof family) => createApp({
  scan: () => scanProject(root),
  ...(under ? { under } : {}),
  createContainer,
  storageFactory: memory,
});

describe('a middleware the frond declares', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__around = []; });

  it('runs around its own frond, and takes its dependencies from the frond scope', async () => {
    await using built = await app();

    await createLocalRunner(built)({ entity: 'note', op: 'list' }, Invocation.empty);

    // `Audit` asks for `Trail`, a service of its own frond — so a middleware is resolved
    // like every other member and not handed in already built.
    expect(around()).toContain('audit:note.list');
  });

  it('leaves a neighbouring frond alone', async () => {
    await using built = await app();

    await createLocalRunner(built)({ entity: 'digest', op: 'count' }, Invocation.empty);

    // `Audit` belongs to `shop`; `digest` answers in `mail`. A frond reaches its neighbours
    // only by standing above them in the tree, which `shop` does not.
    expect(around()).not.toContain('audit:digest.count');
  });

  it('runs nowhere while the frond that holds it serves nothing and nothing is under it', async () => {
    await using built = await app();
    const run = createLocalRunner(built);

    await run({ entity: 'note', op: 'list' }, Invocation.empty);
    await run({ entity: 'digest', op: 'count' }, Invocation.empty);

    // `ops` answers at no address of its own: a middleware reaches what its family serves,
    // and a frond with no family and no handlers reaches nothing.
    expect(around()).not.toContain('everywhere:note.list');
  });

  it('reaches every frond under the one that declares it', async () => {
    await using built = await app(family);
    const run = createLocalRunner(built);

    await run({ entity: 'note', op: 'list' }, Invocation.empty);
    await run({ entity: 'digest', op: 'count' }, Invocation.empty);

    expect(around()).toContain('everywhere:note.list');
    expect(around()).toContain('everywhere:digest.count');
  });

  it('puts the inherited one first, which is the order getMiddlewares promises', async () => {
    await using built = await app(family);

    await createLocalRunner(built)({ entity: 'note', op: 'list' }, Invocation.empty);

    expect(around()).toEqual(['everywhere:note.list', 'audit:note.list']);
  });

  it('is recognized by its FORM — a class without `around` is not one', async () => {
    const scan = await scanProject(root);
    const shop = scan.fronds.find((frond) => frond.name === 'shop');

    // `NotAMiddleware` sits in the directory and declares no `around`. The directory does
    // not make a middleware; stating the method does.
    expect(shop?.middlewares.map((middleware) => middleware.name)).toEqual(['Audit']);
  });
});
