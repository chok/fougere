import { scanProject } from '../src/node.js';
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, callValueOf, FougereError, ErrorCode } from '../src/index.js';
import type { IdentityCard, StorageFactory } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');

// `price` is not decoration: ProductPresenter computes displayPrice from it, and a
// presenter now runs on every façade call — a row missing the field it reads is a bug.
const products = [{ id: '1', name: 'Fern', price: 12.5 }];
const fakeStorage = {
  list: vi.fn(async () => products),
  findById: vi.fn(async (id: string) => products.find((p) => p.id === id)),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};
const storageFactory: StorageFactory = () => fakeStorage as never;

describe('FougereError.fromJSON (dual of toJSON)', () => {
  it('survives a JSON round-trip with code, entity, operation, details intact', () => {
    const original = new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'already exists',
      entity: 'product',
      operation: 'create',
      details: { field: 'name' },
    });
    const revived = FougereError.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));
    expect(revived).toBeInstanceOf(FougereError);
    expect(revived.code).toBe(ErrorCode.CONFLICT);
    expect(revived.message).toBe('already exists');
    expect(revived.entity).toBe('product');
    expect(revived.operation).toBe('create');
    expect(revived.details).toEqual({ field: 'name' });
  });

  it('degrades an unknown code to INTERNAL_ERROR, keeping the original in details', () => {
    const revived = FougereError.fromJSON({ code: 'MADE_UP', message: 'weird wire' });
    expect(revived.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(revived.message).toBe('weird wire');
    expect(revived.details).toEqual({ originalCode: 'MADE_UP', details: undefined });
  });

  it('tolerates garbage input', () => {
    const revived = FougereError.fromJSON('not even an object');
    expect(revived.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(revived.message).toBe('Unknown error');
  });
});

describe('createLocalRunner', () => {
  it('executes a façade operation', async () => {
    const app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
    const run = createLocalRunner(app);
    const result = await run({ entity: 'product', op: 'list' }, EMPTY_INVOCATION);
    // The row, plus what ProductPresenter computes from it. The façade enriches now —
    // it used to be the projections' job alone, so `useQuery` saw none of it.
    expect(result).toEqual([{ ...products[0], displayPrice: '$12.50', isExpensive: false }]);
    await app.dispose();
  });


  it('rejects an unknown operation with a typed NOT_FOUND', async () => {
    const app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
    const run = createLocalRunner(app);
    const failure = run({ entity: 'product', op: 'explode' }, EMPTY_INVOCATION);
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND, entity: 'product', operation: 'explode' });
    await app.dispose();
  });

  it('rejects an entity it does not host with a typed NOT_FOUND, never a forward', async () => {
    const app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
    const run = createLocalRunner(app);
    await expect(run({ entity: 'unicorn', op: 'list' }, EMPTY_INVOCATION))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND, entity: 'unicorn' });
    await app.dispose();
  });

  /**
   * `rpc` is the door for what the app says about ITSELF, and it is a registry — which is
   * what lets an optional package declare a reading core does not hold.
   */
  describe('the rpc door', () => {
    it('names what it serves when an op is unknown — how a missing package reads', async () => {
      await using app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
      const run = createLocalRunner(app);
      // The whole degradation for `@fougere/observability` not being wired: the op it
      // would have declared is simply not there, and the refusal says what is.
      await expect(run({ entity: 'rpc', op: 'topology' }, EMPTY_INVOCATION))
        .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND, entity: 'rpc', operation: 'topology' });
      await expect(run({ entity: 'rpc', op: 'topology' }, EMPTY_INVOCATION))
        .rejects.toThrow(/Unknown rpc operation 'topology'\. It serves discover\./);
    });

    it('serves what a package declared, on the same wire as the card', async () => {
      await using app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
      app.serveRpc('topology', () => ({ fronds: [{ frond: 'catalog', placement: 'local' }] }));

      expect(await createLocalRunner(app)({ entity: 'rpc', op: 'topology' }, EMPTY_INVOCATION))
        .toEqual({ fronds: [{ frond: 'catalog', placement: 'local' }] });
    });

    it('refuses a second declaration rather than replacing the first', async () => {
      await using app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
      app.serveRpc('topology', () => 1);
      // Two packages claiming one name would make the answer depend on wiring order.
      expect(() => app.serveRpc('topology', () => 2)).toThrow(/already served/);
      // And the card cannot be taken over, because it is in the same registry.
      expect(() => app.serveRpc('discover', () => 'mine')).toThrow(/already served/);
    });
  });

  it('serves the identity card on rpc.discover, JSON-serializable', async () => {
    const app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
    const run = createLocalRunner(app);
    const card = await run({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION) as IdentityCard;

    const frondNames = card.fronds.map((f) => f.name).sort();
    expect(frondNames).toEqual(['catalog', 'inventory', 'orders']);

    const catalog = card.fronds.find((f) => f.name === 'catalog')!;
    const product = catalog.doors.find((e) => e.name === 'product')!;
    expect(product.ops.map((o) => o.name)).toEqual(expect.arrayContaining(['list', 'findById', 'search']));
    expect(product.schema).toBeTruthy();

    // An op carries its terms, not just its name: what it is for (the author's own
    // doc sentence), what it takes, and whether it reads or writes.
    const search = product.ops.find((o) => o.name === 'search')!;
    expect(search.description).toBe('Find products by name.');
    expect(search.kind).toBe('query');
    expect(search.input).toBeTruthy();

    const list = product.ops.find((o) => o.name === 'list')!;
    expect(list.kind).toBe('query');
    expect(list.description).toBeUndefined();

    // The card is a wire document — it must survive JSON as-is.
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    await app.dispose();
  });

  it('rejects an unknown rpc operation', async () => {
    const app = await createApp({ scan: await scanProject(fixturesRoot), createContainer, storageFactory });
    const run = createLocalRunner(app);
    await expect(run({ entity: 'rpc', op: 'selfdestruct' }, EMPTY_INVOCATION))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    await app.dispose();
  });
});

describe('callValueOf (fabrication of the call value)', () => {
  it('class + verb: designation from the class name', () => {
    class Post {}
    const { call, invocation } = callValueOf(Post, 'list', { query: { limit: '5' } });
    expect(call).toEqual({ entity: 'post', op: 'list' });
    expect(invocation).toEqual({ ...EMPTY_INVOCATION, query: { limit: '5' } });
  });

  it('raw call passes through untouched', () => {
    const { call, invocation } = callValueOf(
      { entity: 'product', op: 'search' },
      { params: { id: '1' }, body: { q: 'fern' } },
    );
    expect(call).toEqual({ entity: 'product', op: 'search' });
    expect(invocation).toEqual({ ...EMPTY_INVOCATION, params: { id: '1' }, body: { q: 'fern' } });
  });

  it('no input completes to the empty invocation', () => {
    class Post {}
    expect(callValueOf(Post, 'list').invocation).toEqual(EMPTY_INVOCATION);
    expect(callValueOf({ entity: 'post', op: 'list' }).invocation).toEqual(EMPTY_INVOCATION);
  });
});
