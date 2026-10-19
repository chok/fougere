/**
 * Classes that ask for each other refuse the BOOT, read off what the container was handed — and not
 * at the first call, where it used to surface as the container's `dependency cycle: a → b → a`.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, frond } from '../src/index.js';
import { op } from './contract.js';
import type { Declared } from '../src/Declared.js';
import wrapped from './fixtures-ports-wrapped/fronds.js';
import wrappedLogger from './fixtures-logger-wrapped/fronds.js';

class Mailer {}
class Notifier {}
class OrderHandler {
  constructor(readonly notifier: Notifier) {}
  async create() { return 'created'; }
}

const shop = (providers: Declared[]) => frond('shop', {
  providers,
  handlers: [{ ctor: OrderHandler, deps: ['Notifier'], operations: { create: op({ cardinality: 'one' }) } }],
});

describe('classes that ask for each other', () => {
  it('refuse the boot, naming the way round', async () => {
    const providers = [{ ctor: Notifier, deps: ['Mailer'] }, { ctor: Mailer, deps: ['Notifier'] }];

    await expect(createApp({ fronds: [shop(providers)], createContainer }))
      .rejects.toThrow(/Notifier → Mailer → Notifier: each asks for the next in its constructor/);
  });

  it('refuse a class asking for itself', async () => {
    await expect(createApp({ fronds: [shop([{ ctor: Notifier, deps: ['Notifier'] }])], createContainer }))
      .rejects.toThrow(/Notifier asks for itself in its constructor/);
  });

  it('leave a wrapper alone, which names the port it stands in front of', async () => {
    await using app = await createApp({
      fronds: wrapped, createContainer, ports: { Payment: ['RetryingPayment', 'StripePayment'] },
    });

    expect(app.fronds.map((one) => one.name)).toEqual(wrapped.map((one) => one.name));
  });

  it('leave a logger wrapper alone, which names the builtin it keeps', async () => {
    await using app = await createApp({ fronds: wrappedLogger, createContainer });

    expect(app.fronds.map((one) => one.name)).toEqual(wrappedLogger.map((one) => one.name));
  });
});
