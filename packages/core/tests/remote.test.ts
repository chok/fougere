import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner, FougereError, ErrorCode } from '../src/index.js';
import type { App, OrmFactory, Transport } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');
const emptyRoot = '/tmp/fougere-remote-test-empty';

const products = [{ id: '1', name: 'Fern' }, { id: '2', name: 'Moss' }];
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
  return createApp({ root: fixturesRoot, createContainer, ormFactory });
}

async function bootConsumer(host: App, transportSpy?: Transport): Promise<App> {
  return createApp({
    root: emptyRoot,
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

    expect(remote).toEqual(JSON.parse(JSON.stringify(local)));
    expect(remote).toEqual(products);

    await consumer.dispose();
    await host.dispose();
  });

  it('carries the invocation — findById routes params across the wire', async () => {
    const host = await bootHost();
    const consumer = await bootConsumer(host);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    const found = await facade.findById({ ...EMPTY_INVOCATION, params: { id: '2' } });
    expect(found).toEqual({ id: '2', name: 'Moss' });

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
    const facade = await Promise.resolve(consumer.resolve('productHandler'));
    expect(facade).toBeDefined();
    await consumer.dispose();
    await host.dispose();
  });

  it('without remotes, an unknown handler still fails fast at resolve', async () => {
    const app = await createApp({ root: emptyRoot, createContainer });
    expect(() => app.resolve('productHandler')).toThrow(/is not loaded/);
    await app.dispose();
  });

  it('remotes without remoteTransport is a boot-time config error', async () => {
    await expect(
      createApp({ root: emptyRoot, createContainer, remotes: { catalog: 'http://x' } }),
    ).rejects.toThrow(/remoteTransport/);
  });

  it('a remote declaration wins over local presence — metadata stays, hosting moves', async () => {
    const host = await bootHost();
    // Same fixtures on disk, but catalog is declared remote: the frond must be
    // scanned (bridges route with app.fronds) yet not hosted locally.
    const consumer = await createApp({
      root: fixturesRoot,
      createContainer,
      ormFactory,
      remotes: { catalog: 'mem://host' },
      remoteTransport: () => asWire(createLocalRunner(host)),
    });

    expect(consumer.fronds.map((f) => f.name)).toContain('catalog');
    expect(consumer.container.has('productHandler')).toBe(false);

    const facade = consumer.resolve<Record<string, (inv?: unknown) => Promise<unknown>>>('productHandler');
    expect(await facade.list()).toEqual(products);

    await consumer.dispose();
    await host.dispose();
  });
});
