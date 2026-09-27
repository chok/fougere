/**
 * `ports:` in `fougere.config.ts` is read by every host, not by the CLI alone.
 *
 * The web hosts boot through here, and this boot handed `createApp` every key of the config but
 * `ports` — so two realizations of one port refused the boot under Nuxt with the line that
 * settles it written in the file.
 */
import { describe, it, expect } from 'vitest';
import { frond } from '@fougere/core';
import { configureFougere, useFougereApp } from '../src/boot.js';

abstract class Payment { abstract charge(): string; }
class StripePayment extends Payment { charge() { return 'stripe'; } }
class FakePayment extends Payment { charge() { return 'fake'; } }

describe('ports: on a web host', () => {
  it('answers the port with the realization the config names', async () => {
    configureFougere({
      fronds: [frond('shop', { providers: [Payment, StripePayment, FakePayment] })],
      config: { ports: { Payment: 'FakePayment' } },
    });

    const app = await useFougereApp();
    const scope = app.container.resolve('frond:shop') as { resolve(name: string): Payment };

    expect(scope.resolve('Payment').charge()).toBe('fake');
  });
});
