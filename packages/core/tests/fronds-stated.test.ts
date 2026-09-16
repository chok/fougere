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
    expect(statedFronds({
      billing: {},
      cart: { extends: 'billing' },
      blog: 'http://localhost:4100',
      '@fougere/log': './lines.jsonl',
    })).toEqual([
      { key: 'billing', path: 'billing' },
      { key: 'blog', path: 'blog', value: 'http://localhost:4100' },
      { key: '@fougere/log', path: '@fougere/log', value: './lines.jsonl' },
      { key: 'cart', path: 'billing.cart', extends: 'billing' },
    ]);
  });

  it('says the same thing in the long form', () => {
    expect(statedFronds({ blog: { remote: 'http://localhost:4100' } }))
      .toEqual([{ key: 'blog', path: 'blog', value: 'http://localhost:4100' }]);
  });

  it('answers a frond before the ones inheriting from it, whatever the order written', () => {
    const fronds = statedFronds({ cart: { extends: 'billing' }, billing: {}, invoice: { extends: 'billing' } });

    expect(fronds.map((one) => one.key)).toEqual(['billing', 'cart', 'invoice']);
  });

  it('answers nothing for a config that states nothing', () => {
    expect(statedFronds(undefined)).toEqual([]);
  });
});

describe('remotesOf', () => {
  it('reads an address off a string leaf of the tree', () => {
    expect(remotesOf({ fronds: { cart: { extends: 'billing' }, blog: 'http://localhost:4100' } }))
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
