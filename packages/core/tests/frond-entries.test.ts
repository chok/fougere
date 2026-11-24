import { describe, it, expect } from 'vitest';
import { statesModule, type FrondEntries } from '../src/config/FrondEntries.js';
import { keyedFrondEntries, loadedFronds } from '../src/config/KeyedFrondEntry.js';

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
      '@fougere/log': { options: './lines.jsonl' },
    })).toEqual([
      { key: 'billing', path: 'billing' },
      { key: '@fougere/log', path: '@fougere/log', value: './lines.jsonl' },
      { key: 'cart', path: 'billing.cart', extends: 'billing' },
    ]);
  });

  it('refuses an address written as the entry, naming the file that places a frond', () => {
    const entries = { blog: 'http://localhost:4100' } as unknown as FrondEntries;

    expect(() => keyedFrondEntries(entries))
      .toThrow("the entry 'blog' is a string. Where a frond answers is written under processes:.");
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

describe('loadedFronds', () => {
  const project = [{ name: 'shop' }, { name: 'cart' }, { name: 'blog' }];
  const entries = { shop: {}, cart: { extends: 'shop' }, blog: {} };

  it('loads the frond a child extends beside it, since the child takes its code', () => {
    expect(loadedFronds(project, ['cart'], entries).map((frond) => frond.name)).toEqual(['shop', 'cart']);
  });

  it('loads every frond when the process is the app', () => {
    expect(loadedFronds(project, undefined, entries)).toHaveLength(3);
  });

  it('refuses a name the project has no frond for, naming the ones it has', () => {
    expect(() => loadedFronds(project, ['blgo'], entries))
      .toThrow("processes: has this process run 'blgo', which the project has no frond for. It has 'shop', 'cart', 'blog'.");
  });
});
