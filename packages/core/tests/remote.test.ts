import { scanProject } from '../src/node.js';
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, createAppRunner, FougereError, ErrorCode } from '../src/index.js';
import type { App, OrmFactory, Transport } from '../src/index.js';
import type { SchemaView } from '@fougere/schema';
import { EMPTY_INVOCATION } from '../src/wire/invocation.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');
const emptyRoot = '/tmp/fougere-remote-test-empty';

// `price` feeds ProductPresenter.displayPrice — the presenter runs on every call now.
const products = [{ id: '1', name: 'Fern', price: 12.5 }, { id: '2', name: 'Moss', price: 320 }];
const fakeOrm = {
  list: vi.fn(async () => products),
  findById: vi.fn(async (id: string) => products.find((p) => p.id === id)),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};
const ormFactory: OrmFactory = () => fakeOrm as never;

/**
 * In-memory wire — an honest stand-in for HTTP: everything crosses as JSON,
 * both directions, errors included. What this wire can't carry, HTTP can't either.
 */
const asWire = (runner: Transport): Transport => async (call, invocation) => {
  const sent = JSON.parse(JSON.stringify({ call, invocation }));
  try {
    return JSON.parse(JSON.stringify(await runner(sent.call, sent.invocation)));
  } catch (err) {
    if (err instanceof FougereError) {
      throw FougereError.fromJSON(JSON.parse(JSON.stringify(err.toJSON())));
    }
    throw err;
  }
};

async function bootHost(): Promise<App> {
  return createApp({ scan: await scanProject(fixturesRoot), createContainer, ormFactory });
}

async function bootConsumer(host: App, transportSpy?: Transport): Promise<App> {
  return createApp({
    scan: await scanProject(emptyRoot),
    createContainer,
    remotes: { catalog: 'mem://host' },
    remoteTransport: () => transportSpy ?? asWire(createLocalRunner(host)),
  });
}

describe('remote façade (repli)', () => {
  it('executes remotely with parity against the local runner', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    const remote = await facade.list();
    const local = await createLocalRunner(host)({ entity: 'product', op: 'list' }, EMPTY_INVOCATION);

    // Parity is the claim: the same enrichment on both sides, computed where the
    // frond is hosted and carried across untouched.
    expect(remote).toEqual(JSON.parse(JSON.stringify(local)));
    expect(remote).toEqual(products.map((p) => ({
      ...p,
      displayPrice: `$${p.price.toFixed(2)}`,
      isExpensive: p.price > 100,
    })));

    await consumer.dispose();
    await host.dispose();
  });

  /**
   * The door the browser actually knocks on: `createAppRunner`, not the façade object.
   * Every other test here calls `facade.list()` directly, which only exercises the
   * proxy's `get` trap — so a stand-in that answered `get` but denied `hasOwn` passed
   * them all while every real split call came back `Unknown operation`. The runner
   * checks `Object.hasOwn` before calling; the traps must agree.
   */
  it('answers through the app runner — the path the browser endpoint takes', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const run = createAppRunner(consumer);
    expect(await run({ entity: 'product', op: 'list' }, EMPTY_INVOCATION))
      .toMatchObject([{ id: '1', displayPrice: '$12.50' }, { id: '2', displayPrice: '$320.00' }]);

    // What the proxy must NOT claim: Object.prototype's own names are not operations.
    await expect(run({ entity: 'product', op: 'constructor' }, EMPTY_INVOCATION))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    await consumer.dispose();
    await host.dispose();
  });

  it('carries the invocation — findById routes params across the wire', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    const found = await facade.findById({ ...EMPTY_INVOCATION, params: { id: '2' } });
    expect(found).toEqual({ id: '2', name: 'Moss', price: 320, displayPrice: '$320.00', isExpensive: true });

    // A miss is null on every transport — undefined has no wire form.
    const miss = await facade.findById({ ...EMPTY_INVOCATION, params: { id: 'nope' } });
    expect(miss).toBeNull();

    await consumer.dispose();
    await host.dispose();
  });

  it('a FougereError crosses typed — code, entity, operation intact', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    const failure = facade.explode();
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      entity: 'product',
      operation: 'explode',
    });

    await consumer.dispose();
    await host.dispose();
  });

  it('an entity no declared remote hosts fails typed at first call, not at resolve', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('unicornHandler');
    await expect(facade.list()).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      entity: 'unicorn',
    });

    await consumer.dispose();
    await host.dispose();
  });

  it('an unreachable remote fails SERVICE_UNAVAILABLE and names it', async () => {
    const host = await bootHost();
    const dead: Transport = async () => { throw new TypeError('fetch failed'); };
    const consumer = await bootConsumer(host, dead);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    const failure = facade.list();
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
    await expect(failure).rejects.toThrow(/catalog/);

    await consumer.dispose();
    await host.dispose();
  });

  it('discovers once — the identity card is cached across calls', async () => {
    const host = await bootHost();
    const wire = asWire(createLocalRunner(host));
    const spy = vi.fn(wire);
    const consumer = await bootConsumer(host, spy);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    await facade.list();
    await facade.list();
    await facade.findById({ ...EMPTY_INVOCATION, params: { id: '1' } });

    const discoverCalls = spy.mock.calls.filter(([call]) => call.entity === 'rpc' && call.op === 'discover');
    expect(discoverCalls).toHaveLength(1);

    await consumer.dispose();
    await host.dispose();
  });

  it('the façade is not a thenable — awaiting resolve() stays safe', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);
    const facade = await Promise.resolve(consumer.resolve<Record<string, Function>>('productHandler'));
    expect(facade).toBeDefined();
    expect('list' in facade).toBe(true);
    expect(Object.hasOwn(facade, 'list')).toBe(true);
    expect(facade.then).toBeUndefined();
    expect(facade.constructor).toBeUndefined();
    expect(facade.toJSON).toBeUndefined();
    expect(JSON.stringify(facade)).toBe('{}');
    await consumer.dispose();
    await host.dispose();
  });

  it('without remotes, an unknown handler still fails fast at resolve', async () => {
    const app = await createApp({ scan: await scanProject(emptyRoot), createContainer });
    expect(() => app.resolve('productHandler')).toThrow(/is not loaded/);
    await app.dispose();
  });

  it('refuses a remote whose identity card cannot be walked, naming it', async () => {
    const app = await createApp({
      scan: await scanProject(emptyRoot),
      createContainer,
      remotes: { catalog: 'http://catalog.test' },
      remoteTransport: () => async () => ({ fronds: [{ name: 'blog' }] }) as never,
    });
    // `card.fronds is not iterable` was what this produced: a TypeError naming neither
    // the remote nor its address, on the one path where the value came from another process.
    await expect(createAppRunner(app)({ entity: 'post', op: 'list' }, EMPTY_INVOCATION))
      .rejects.toThrow(/Remote 'catalog' \(http:\/\/catalog.test\).*frond 'blog' has no valid doors array/s);
  });

  it('remotes without remoteTransport is a boot-time config error', async () => {
    await expect(
      createApp({ scan: await scanProject(emptyRoot), createContainer, remotes: { catalog: 'http://x' } }),
    ).rejects.toThrow(/remoteTransport/);
  });

  it('schemaFor reconstructs a live, validating schema for an entity with no local class', async () => {
    const host = await bootHost();
    // emptyRoot: the consumer scans NOTHING — no Product.ts exists anywhere in
    // this app. Everything it knows about 'product' comes off the wire.
    const consumer = await bootConsumer(host);

    // `schemaFor` promises `SchemaView` — the minimum an adapter needs, and all a
    // hand-rolled `{ getFields() }` entity can honour. This one came off the wire and
    // through `Card.toSchema()`, which builds a real schema constructor, so it judges.
    const Product = await consumer.schemaFor('product') as SchemaView;

    // Not just present — actually exploitable: same field set as the host's
    // real entity, and the reconstructed shape rules (min: 0 on price) still judge.
    expect(Object.keys(Product.getFields())).toEqual(['id', 'name', 'price']);

    const tooCheap = Product.validate({ name: 'Fern', price: -5 });
    expect(tooCheap.success).toBe(false);
    if (!tooCheap.success) expect(tooCheap.errors[0]).toMatchObject({ path: 'price' });

    const strayField = Product.validate({ name: 'Fern', price: 5, color: 'green' });
    expect(strayField.success).toBe(false);
    if (!strayField.success) expect(strayField.errors[0].message).toMatch(/Unknown field/);

    // id is auto-generated ({generate}) — a create payload need not supply it.
    const valid = Product.validate({ name: 'Fern', price: 5 });
    expect(valid.success).toBe(true);

    await consumer.dispose();
    await host.dispose();
  });

  it('schemaFor returns the local entityClass directly — no reconstruction, no network', async () => {
    const host = await bootHost();
    const Product = await host.schemaFor('product');
    // The host scanned Product.ts itself: same identity as the frond descriptor.
    expect(Product).toBe(host.fronds.find((f) => f.name === 'catalog')!.entities.find((e) => e.name === 'product')!.entityClass);
    await host.dispose();
  });

  it('schemaFor rejects an entity nothing declares, local or remote', async () => {
    const app = await createApp({ scan: await scanProject(emptyRoot), createContainer });
    await expect(app.schemaFor('unicorn')).rejects.toThrow(/is not loaded/);
    await app.dispose();
  });

  it('a remote declaration wins over local presence — metadata stays, hosting moves', async () => {
    const host = await bootHost();
    // Same fixtures on disk, but catalog is declared remote: the frond must be
    // scanned (bridges route with app.fronds) yet not hosted locally.
    const consumer = await createApp({
      scan: await scanProject(fixturesRoot),
      createContainer,
      ormFactory,
      remotes: { catalog: 'mem://host' },
      remoteTransport: () => asWire(createLocalRunner(host)),
    });

    expect(consumer.fronds.map((f) => f.name)).toContain('catalog');
    expect(consumer.container.has('productHandler')).toBe(false);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    expect(await facade.list()).toMatchObject([{ id: '1' }, { id: '2' }]);

    await consumer.dispose();
    await host.dispose();
  });
});

/**
 * The half of the collision that `assertOneOwnerPerKey` cannot reach.
 *
 * The boot refuses two LOCAL fronds claiming one door key, and skips fronds declared
 * remote because they register nothing locally. So the same collision survived across the
 * wire — and it kept the OTHER duplicate: in process `registerValue` let the last frond
 * loaded win, here `if (!byEntity.has(...))` let the first card received win. One
 * application, two topologies, two different handlers answering.
 */
describe('two remotes serving one entity', () => {
  /** A remote that answers `rpc.discover` with one door of the given name, and nothing else. */
  const serving = (frond: string, door: string): Transport => async (call) => {
    if (call.entity === 'rpc') {
      return { fronds: [{ name: frond, doors: [{ name: door, ops: [{ name: 'list', kind: 'query' }] }], facts: [] }] };
    }
    return [];
  };

  it('is refused, and the message names both', async () => {
    await using consumer = await createApp({
      scan: await scanProject(emptyRoot),
      createContainer,
      remotes: { east: 'mem://east', west: 'mem://west' },
      remoteTransport: (url) => (url.endsWith('east') ? serving('catalog', 'product') : serving('stock', 'product')),
    });

    const facade = consumer.resolve<Record<string, () => Promise<unknown>>>('productHandler');
    // Routing is lazy, so the refusal lands on the first call that misses — the same
    // place every other routing answer lands.
    await expect(facade.list()).rejects.toThrow(/Two remotes serve 'product': 'east' and 'west'/);
  });

  it('says the same thing whichever remote answers first', async () => {
    // The old loop read each card inside `Promise.all`, so the winner was whoever
    // replied first. Indexing now follows the order `remotes:` declares, which is the
    // only order a reader can predict from their own config.
    const slowEast: Transport = async (call) => {
      await new Promise((r) => setTimeout(r, 20));
      return serving('catalog', 'product')(call, EMPTY_INVOCATION);
    };

    await using consumer = await createApp({
      scan: await scanProject(emptyRoot),
      createContainer,
      remotes: { east: 'mem://east', west: 'mem://west' },
      remoteTransport: (url) => (url.endsWith('east') ? slowEast : serving('stock', 'product')),
    });

    const facade = consumer.resolve<Record<string, () => Promise<unknown>>>('productHandler');
    await expect(facade.list()).rejects.toThrow(/'east' and 'west'/);
  });

  it('leaves a name only one of them serves alone', async () => {
    await using consumer = await createApp({
      scan: await scanProject(emptyRoot),
      createContainer,
      remotes: { east: 'mem://east', west: 'mem://west' },
      remoteTransport: (url) => (url.endsWith('east') ? serving('catalog', 'product') : serving('stock', 'crate')),
    });

    const facade = consumer.resolve<Record<string, () => Promise<unknown>>>('crateHandler');
    await expect(facade.list()).resolves.toEqual([]);
  });
});
