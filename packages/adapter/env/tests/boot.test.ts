/** From the config to the constructor: `sources: { env: { type: 'env', values: ['Meili'] } }`. */
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { entity, number, text, url } from '@fougere/schema';
import { createApp, frond } from '@fougere/core';
import { layerOf, resolveStorage } from '@fougere/defaults';
import '../src/index.js';

class Meili extends entity({ url: url(), key: text(), timeoutMs: number({ integer: true, default: 2000 }) }) {}
class Search {
  constructor(readonly meili: Meili) {}
}

const fronds = [frond('search', { entities: [Meili], providers: [{ ctor: Search, deps: ['Meili'] }] })];
const booting = () => createApp({ createContainer, fronds, ...layerOf(resolveStorage({ env: { type: 'env', values: ['Meili'] } })) });

afterEach(() => {
  delete process.env.MEILI_URL;
  delete process.env.MEILI_KEY;
});

describe('a value from the environment', () => {
  it('reaches the class that names it, read and completed', async () => {
    process.env.MEILI_URL = 'https://meili.test';
    process.env.MEILI_KEY = 'k';
    await using app = await booting();

    expect(app.container.resolve<Container>('frond:search').resolve<Search>('Search').meili)
      .toEqual({ url: 'https://meili.test', key: 'k', timeoutMs: 2000 });
  });

  it('refuses the boot naming the variable that is missing', async () => {
    process.env.MEILI_URL = 'https://meili.test';

    await expect(booting()).rejects.toThrow(/meili\.key: Required — sources\.env, MEILI_KEY/);
  });
});
