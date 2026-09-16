import { describe, it, expect } from 'vitest';
import { statedFronds, statesModule, mergeStated } from '../src/FrondsStated.js';
import { remotesOf } from '../src/FougereConfig.js';

describe('statesModule', () => {
  it('tells a module specifier from a frond name', () => {
    expect(statesModule('@fougere/log')).toBe(true);
    expect(statesModule('./fronds/audit.js')).toBe(true);
    expect(statesModule('acme/audit')).toBe(true);
    expect(statesModule('shop')).toBe(false);
    expect(statesModule('log')).toBe(false);
  });
});

describe('statedFronds', () => {
  it('reads the cases off the shape of an entry', () => {
    const { fronds } = statedFronds({
      shop: { fronds: ['cart', 'pricing'] },
      blog: 'http://localhost:4100',
      '@fougere/log': './lines.jsonl',
    });

    expect(fronds).toEqual([
      { key: 'shop', path: 'shop' },
      { key: 'blog', path: 'blog', value: 'http://localhost:4100' },
      { key: '@fougere/log', path: '@fougere/log', value: './lines.jsonl' },
      { key: 'cart', path: 'shop.cart', under: 'shop' },
      { key: 'pricing', path: 'shop.pricing', under: 'shop' },
    ]);
  });

  it('says the same thing in the long form', () => {
    const { fronds } = statedFronds({ blog: { remote: 'http://localhost:4100' } });

    expect(fronds).toEqual([{ key: 'blog', path: 'blog', value: 'http://localhost:4100' }]);
  });

  it('answers a frond before the ones that inherit from it', () => {
    const { fronds } = statedFronds({
      cart: { fronds: ['basket'] },
      shop: { fronds: ['cart'] },
    });

    expect(fronds.map((one) => one.key)).toEqual(['shop', 'cart', 'basket']);
  });

  it('reports a name two families claim rather than resolving it', () => {
    const { twice } = statedFronds({ shop: { fronds: ['cart'] }, mail: { fronds: ['cart'] } });

    expect(twice).toEqual([{ key: 'cart', paths: ['shop.cart', 'mail.cart'] }]);
  });

  it('answers nothing for a config that states nothing', () => {
    expect(statedFronds(undefined).fronds).toEqual([]);
  });
});

describe('mergeStated', () => {
  it('adds a frond to a family without erasing the ones already named', () => {
    const merged = mergeStated(
      { shop: { fronds: ['cart', 'pricing'] } },
      { shop: { fronds: ['catalog'] } },
    );

    expect(merged).toEqual({ shop: { fronds: ['cart', 'pricing', 'catalog'] } });
  });

  it('lets an override redirect one frond and keep the others', () => {
    const merged = mergeStated(
      { blog: {}, shop: { fronds: ['cart'] } },
      { blog: 'http://localhost:4100' },
    );

    expect(merged).toEqual({ blog: 'http://localhost:4100', shop: { fronds: ['cart'] } });
  });

  it('can fold two levels into a cycle, which one config alone never could', () => {
    const merged = mergeStated({ shop: { fronds: ['cart'] } }, { cart: { fronds: ['shop'] } });
    const { fronds } = statedFronds(merged);

    // Each names the other as its child, so each is under the other — a pair no order can
    // satisfy. Nothing here resolves it: `parentsFirst` does not loop, and the boot refuses.
    expect(fronds.map((one) => [one.key, one.under])).toEqual([['cart', 'shop'], ['shop', 'cart']]);
  });
});

describe('remotesOf', () => {
  it('reads an address off a string leaf of the tree', () => {
    expect(remotesOf({ fronds: { shop: { fronds: ['cart'] }, blog: 'http://localhost:4100' } }))
      .toEqual({ blog: 'http://localhost:4100' });
  });

  it('leaves a module argument out — it is not an address', () => {
    expect(remotesOf({ fronds: { '@fougere/log': './lines.jsonl' } })).toEqual({});
  });

  it('reads an address in either form', () => {
    expect(remotesOf({ fronds: { blog: 'http://a', ledger: { remote: 'http://b' } } }))
      .toEqual({ blog: 'http://a', ledger: 'http://b' });
  });
});
