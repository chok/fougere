/**
 * A dependency nothing answers refuses the BOOT, read off what the class declares — and not at
 * its first call, where it used to surface as the container's `'Mailer' is not registered`.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, frond } from '../src/index.js';
import { op } from './contract.js';
import type { Declared } from '../src/Declared.js';

class Mailer {}
class Notifier {
  constructor(readonly mailer: Mailer) {}
}
class OrderHandler {
  constructor(readonly notifier: Notifier) {}
  async create() { return 'created'; }
}

const shop = (providers: Declared[]) => frond('shop', {
  providers,
  handlers: [{ ctor: OrderHandler, deps: ['Notifier'], operations: { create: op({ cardinality: 'one' }) } }],
});

describe('a dependency nothing answers', () => {
  it('refuses the boot, naming the class, what it asks for and its frond', async () => {
    await expect(createApp({ fronds: [shop([{ ctor: Notifier, deps: ['Mailer'] }])], createContainer }))
      .rejects.toThrow(/Notifier asks for Mailer, and nothing in frond 'shop' or above it answers that name/);
  });

  it('boots once something answers it', async () => {
    await using app = await createApp({ fronds: [shop([Mailer, { ctor: Notifier, deps: ['Mailer'] }])], createContainer });

    expect(app.fronds.map((one) => one.name)).toEqual(['shop']);
  });
});
