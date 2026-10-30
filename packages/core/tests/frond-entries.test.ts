import { describe, it, expect } from 'vitest';
import { statesModule, type FrondEntries } from '../src/FrondEntries.js';
import { keyedFrondEntries } from '../src/KeyedFrondEntry.js';
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

describe('keyedFrondEntries', () => {
  it('reads the cases off the shape of an entry', () => {
    expect(keyedFrondEntries({
      billing: {},
      cart: { extends: 'billing' },
      blog: { remote: 'http://localhost:4100' },
      '@fougere/log': { options: './lines.jsonl' },
    })).toEqual([
      { key: 'billing', path: 'billing' },
      { key: 'blog', path: 'blog', value: 'http://localhost:4100' },
      { key: '@fougere/log', path: '@fougere/log', value: './lines.jsonl' },
      { key: 'cart', path: 'billing.cart', extends: 'billing' },
    ]);
  });

  it('refuses a string, naming the object to write', () => {
    const entries = { blog: 'http://localhost:4100' } as unknown as FrondEntries;

    expect(() => keyedFrondEntries(entries))
      .toThrow("the entry 'blog' is a string. Write blog: { remote: 'http://localhost:4100' }.");
  });

  it('refuses a string under a module key too, naming options', () => {
    const entries = { '@fougere/log': './lines.jsonl' } as unknown as FrondEntries;

    expect(() => keyedFrondEntries(entries))
      .toThrow("Write '@fougere/log': { options: './lines.jsonl' }.");
  });

  it('answers a frond before the ones inheriting from it, whatever the order written', () => {
    const fronds = keyedFrondEntries({ cart: { extends: 'billing' }, billing: {}, invoice: { extends: 'billing' } });

    expect(fronds.map((one) => one.key)).toEqual(['billing', 'cart', 'invoice']);
  });

  it('answers nothing for a config that states nothing', () => {
    expect(keyedFrondEntries(undefined)).toEqual([]);
  });
});

describe('remotesOf', () => {
  it('reads the address of each frond that answers elsewhere', () => {
    expect(remotesOf({ fronds: { cart: { extends: 'billing' }, blog: { remote: 'http://localhost:4100' } } }))
      .toEqual({ blog: 'http://localhost:4100' });
  });

  it('leaves a module argument out — it is not an address', () => {
    expect(remotesOf({ fronds: { '@fougere/log': { options: './lines.jsonl' } } })).toEqual({});
  });
});
