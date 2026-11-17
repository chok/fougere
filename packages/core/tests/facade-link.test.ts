/**
 * A link in front of a facade the frond CALLS — `implements Partial<Facade<ProductHandler>>` with
 * an `inner` — stands around that facade's operations, by method name, wherever the facade answers.
 * The handler that calls it says nothing of either.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createAppRunner, createLocalRunner, ErrorCode, FougereError, frond, Invocation, type Transport } from '../src/index.js';
import { op } from './contract.js';

const trail: string[] = [];

class ProductHandler {
  async charge(): Promise<number> {
    trail.push('charged');

    return 42;
  }
}

class CartHandler {
  constructor(private products: { charge(): Promise<number> }) {}

  async checkout(): Promise<{ cents: number }> {
    return { cents: await this.products.charge() };
  }
}

class RetryingProducts {
  constructor(private inner: { charge(): Promise<number> }) {}

  async charge(): Promise<number> {
    try {
      return await this.inner.charge();
    } catch (cause) {
      if (!(cause instanceof FougereError) || cause.code !== ErrorCode.GATEWAY_TIMEOUT) throw cause;
      trail.push('retried');

      return this.inner.charge();
    }
  }
}

const fronds = () => [
  frond('catalog', { handlers: [{ ctor: ProductHandler, operations: { charge: op({ cardinality: 'one' }) } }] }),
  frond('cart', {
    handlers: [{ ctor: CartHandler, deps: ['Facade<ProductHandler>'], operations: { checkout: op({ cardinality: 'one' }) } }],
    providers: [{ ctor: RetryingProducts, name: 'RetryingProducts', deps: ['Facade<ProductHandler>'], implements: ['Facade<ProductHandler>'] }],
  }),
];

const boot = (extra: Record<string, unknown> = {}) =>
  createApp({ createContainer, storageFactory: () => ({}) as never, fronds: fronds(), ...extra });

const timingOutOnce = (far: Parameters<typeof createLocalRunner>[0]): Transport => {
  let first = true;

  return async (call, invocation) => {
    if (call.address !== 'rpc' && first) {
      first = false;
      throw new FougereError({ code: ErrorCode.GATEWAY_TIMEOUT, message: 'the far side did not answer in time' });
    }

    return createLocalRunner(far)(call, invocation);
  };
};

describe('a link in front of a facade the frond calls', () => {
  it('stands around it in one process', async () => {
    trail.length = 0;
    await using app = await boot();

    expect(await createLocalRunner(app)({ address: 'cart', op: 'checkout' }, Invocation.empty)).toEqual({ cents: 42 });
    expect(trail).toEqual(['charged']);
  });

  it('stands around it when the facade answers in another process, and asks again after a timeout', async () => {
    trail.length = 0;
    await using far = await boot();
    await using near = await boot({ remotes: { catalog: 'http://catalog.test' }, remoteTransport: () => timingOutOnce(far) });

    expect(await createAppRunner(near)({ address: 'cart', op: 'checkout' }, Invocation.empty)).toEqual({ cents: 42 });
    expect(trail).toEqual(['retried', 'charged']);
  });
});
