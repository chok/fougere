/**
 * A provider that closes — `[Symbol.asyncDispose]` — is kept by its frond's
 * scope and closed with it.
 *
 * Built per consumer, every consumer opens its own and the app's disposal closes none of them.
 * Measured 2026-09-15 — two handlers declaring one service opened two connections, and
 * `app.dispose()` closed zero. The container reads the method, not an `implements` that the
 * compilation erases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/boot/bootstrap.js';
import { frond } from '../src/index.js';
import { op } from './contract.js';
import { type StorageFactory } from '../src/storage/StorageFactory.js';
import Ledger from './fixtures-kept/fronds/shop/services/Ledger.js';
import Clock from './fixtures-kept/fronds/shop/services/Clock.js';
import fronds from './fixtures-kept/fronds.js';

const storageFactory = (() => ({
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
  output: vi.fn(),
  client: {},
})) as unknown as StorageFactory;

const booted = async () => createApp({ fronds, storageFactory });

describe('a provider its scope keeps', () => {
  beforeEach(() => {
    Ledger.opened = 0;
    Ledger.closed = 0;
    Clock.opened = 0;
  });

  it('is built once for the frond, however many consumers ask', async () => {
    const app = await booted();

    await app.facadeFor('item')!.list!({});
    await app.facadeFor('order')!.list!({});

    expect(Ledger.opened, 'one Ledger for two handlers').toBe(1);
    expect(Clock.opened, 'one Clock per consumer — it states nothing').toBe(2);

    await app.dispose();
  });

  it('is closed when the app is', async () => {
    const app = await booted();
    await app.facadeFor('item')!.list!({});

    expect(Ledger.closed).toBe(0);
    await app.dispose();

    expect(Ledger.closed, 'the frond scope closes what it kept').toBe(1);
  });

  it('leaves a provider that states nothing to its caller', async () => {
    const app = await booted();
    await app.facadeFor('item')!.list!({});
    await app.dispose();

    expect(Clock.opened).toBe(1);
  });
});

describe('a port realization that closes', () => {
  abstract class Payment { abstract charge(): string; }

  class StripePayment extends Payment {
    static opened = 0;
    static closed = 0;

    constructor() { super(); StripePayment.opened += 1; }

    charge(): string { return 'charged'; }

    async [Symbol.asyncDispose](): Promise<void> { StripePayment.closed += 1; }
  }

  class CartHandler { constructor(private payment: Payment) {} async pay() { return this.payment.charge(); } }
  class RefundHandler { constructor(private payment: Payment) {} async pay() { return this.payment.charge(); } }

  it('is kept under the port and closed with the app', async () => {
    const app = await createApp({
      fronds: [frond('billing', {
        providers: [Payment, StripePayment],
        handlers: [
          { ctor: CartHandler, deps: ['Payment'], operations: { pay: op({ cardinality: 'one' }) } },
          { ctor: RefundHandler, deps: ['Payment'], operations: { pay: op({ cardinality: 'one' }) } },
        ],
      })],
      storageFactory,
    });

    await app.facadeFor('cart')!.pay!({});
    await app.facadeFor('refund')!.pay!({});
    expect(StripePayment.opened, 'one realization for two handlers').toBe(1);

    await app.dispose();
    expect(StripePayment.closed).toBe(1);
  });
});
