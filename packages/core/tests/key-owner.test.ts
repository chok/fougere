/**
 * One key, one owner — the container refuses a second registration in a scope. When a check
 * already refused the line that collides, the boot answers with that check, which names the file.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond } from '../src/index.js';

class Post extends entity({ id: primary(), title: text() }) {}
class Dispatcher {}

const storageFactory = () => ({}) as never;

describe('a provider named like a key core answers', () => {
  it('is answered by the check that names it, not by the container', async () => {
    await expect(createApp({
      fronds: [frond('blog', { entities: [Post], providers: [Dispatcher] })],
      createContainer,
      storageFactory,
    })).rejects.toThrow(/\[port-key-taken\] Dispatcher/);
  });

  it('names every frond that does it, not the first', async () => {
    class Item extends entity({ id: primary(), name: text() }) {}

    await expect(createApp({
      fronds: [
        frond('blog', { entities: [Post], providers: [Dispatcher] }),
        frond('shop', { entities: [Item], providers: [Dispatcher] }),
      ],
      createContainer,
      storageFactory,
    })).rejects.toThrow(/2 declaration\(s\)[\s\S]*port-key-taken[\s\S]*port-key-taken/);
  });

  it('boots once it is named for what it is', async () => {
    class PostArchive {}
    await using app = await createApp({
      fronds: [frond('blog', { entities: [Post], providers: [PostArchive] })],
      createContainer,
      storageFactory,
    });

    expect(app.fronds.map((one) => one.name)).toEqual(['blog']);
  });
});

describe('a class name two files share', () => {
  it('is refused, and the rest of the frond is still judged', async () => {
    class Payment {}
    class StripePayment extends Payment {}
    class OgonePayment extends Payment {}
    class Pricing {}
    const SecondPricing = class Pricing {};

    await expect(createApp({
      fronds: [frond('shop', {
        providers: [
          { ctor: Pricing, filePath: 'services/Pricing.ts' },
          { ctor: SecondPricing, filePath: 'services/PricingRate.ts' },
          Payment, StripePayment, OgonePayment,
        ] as never,
      })],
      createContainer,
      storageFactory,
    })).rejects.toThrow(/\[provider-name-taken\] Pricing[\s\S]*\[port-implemented-twice\] Payment/);
  });
});
