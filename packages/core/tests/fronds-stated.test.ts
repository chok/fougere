import { describe, it, expect } from 'vitest';
import { statedFronds, statesModule, mergeStated } from '../src/FrondsStated.js';

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
  it('reads the four cases off the shape', () => {
    const { fronds } = statedFronds({
      shop: { cart: {}, pricing: {} },
      blog: 'http://localhost:4100',
      '@fougere/log': './lines.jsonl',
    });

    expect(fronds).toEqual([
      { key: 'shop', path: 'shop' },
      { key: 'cart', path: 'shop.cart', under: 'shop' },
      { key: 'pricing', path: 'shop.pricing', under: 'shop' },
      { key: 'blog', path: 'blog', value: 'http://localhost:4100' },
      { key: '@fougere/log', path: '@fougere/log', value: './lines.jsonl' },
    ]);
  });

  it('answers parents before their children', () => {
    const { fronds } = statedFronds({ shop: { cart: { basket: {} } } });

    expect(fronds.map((one) => one.key)).toEqual(['shop', 'cart', 'basket']);
  });

  it('reports a name stated twice rather than resolving it', () => {
    const { fronds, twice } = statedFronds({ shop: { cart: {} }, mail: { cart: {} } });

    expect(twice).toEqual([{ key: 'cart', paths: ['shop.cart', 'mail.cart'] }]);
    expect(fronds.map((one) => one.key)).toEqual(['shop', 'cart', 'mail']);
  });

  it('answers nothing for a config that states nothing', () => {
    expect(statedFronds(undefined).fronds).toEqual([]);
  });
});

describe('mergeStated', () => {
  it('adds a frond without erasing the family it sits in', () => {
    const merged = mergeStated(
      { shop: { cart: {}, pricing: {} } },
      { shop: { catalog: {} } },
    );

    expect(merged).toEqual({ shop: { cart: {}, pricing: {}, catalog: {} } });
  });

  it('lets an override redirect one frond and keep the others', () => {
    const merged = mergeStated(
      { blog: {}, shop: { cart: {} } },
      { blog: 'http://localhost:4100' },
    );

    expect(merged).toEqual({ blog: 'http://localhost:4100', shop: { cart: {} } });
  });

  it('can fold two levels into a cycle, which one literal alone never could', () => {
    const merged = mergeStated({ shop: { cart: {} } }, { cart: { shop: {} } });

    expect(merged).toEqual({ shop: { cart: {} }, cart: { shop: {} } });
    expect(statedFronds(merged).twice).toEqual([{ key: 'cart', paths: ['shop.cart', 'cart'] }]);
  });
});
