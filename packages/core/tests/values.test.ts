/**
 * An entity a source holds as ONE value is injected as that value — read, completed by its
 * defaults, judged at boot, and handed to the constructor that names it.
 */
import { describe, it, expect } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { entity, number, primary, text, url, type SchemaView } from '@fougere/schema';
import { createApp, frond, type ValueSources } from '../src/index.js';
import { Repository } from '../src/prefab/Repository.js';
import { op } from './contract.js';

class Meili extends entity({ url: url(), key: text(), timeoutMs: number({ integer: true, default: 2000 }) }) {}
class Post extends entity({ id: primary(), title: text() }) {}

class Search {
  constructor(readonly meili: Meili) {}
}
class MeiliRepository extends Repository<Meili> {}
class PostHandler {
  constructor(readonly post: Post) {}
  async list() { return []; }
}

/** Values kept in a Map, said to live in `env`. */
const valuesOf = (held: Record<string, Record<string, unknown>>): ValueSources => ({
  sourceOf: (name) => (name in held ? 'env' : undefined),
  read: async (name) => held[name],
  where: (name, _entity: SchemaView, field) => `sources.env, ${name.toUpperCase()}_${field?.toUpperCase() ?? '*'}`,
});

const storageFactory = () => ({}) as never;

const booting = (values: ValueSources, declared: Parameters<typeof frond>[1] = { entities: [Meili], providers: [{ ctor: Search, deps: ['Meili'] }] }) =>
  createApp({ createContainer, storageFactory, values, fronds: [frond('search', declared)] });

describe('a value held by a source', () => {
  it('is injected as it is, its defaults filled', async () => {
    await using app = await booting(valuesOf({ meili: { url: 'https://meili.test', key: 'k' } }));
    const search = app.container.resolve<Container>('frond:search').resolve<Search>('Search');

    expect(search.meili).toEqual({ url: 'https://meili.test', key: 'k', timeoutMs: 2000 });
  });

  it('refuses the boot when it does not hold, naming each field and where to change it', async () => {
    const refusal = booting(valuesOf({ meili: { url: 'not a url' } }));

    await expect(refusal).rejects.toThrow(/meili\.url: .* — sources\.env, MEILI_URL/);
    await expect(refusal).rejects.toThrow(/meili\.key: Required — sources\.env, MEILI_KEY/);
  });

  it('refuses a source holding nothing for it, the way it refuses a field missing', async () => {
    await expect(booting(valuesOf({ meili: undefined as never }))).rejects.toThrow(/meili\.url: Required/);
  });

  it('lives in the frond a family inherits from, which may not hold rows', async () => {
    await using app = await createApp({
      createContainer,
      storageFactory,
      values: valuesOf({ meili: { url: 'https://meili.test', key: 'k' } }),
      under: { cart: { extends: 'shop' } },
      fronds: [frond('shop', { entities: [Meili] }), frond('cart', { providers: [{ ctor: Search, deps: ['Meili'] }] })],
    });
    const search = app.container.resolve<Container>('frond:cart').resolve<Search>('Search');

    expect(search.meili.url).toBe('https://meili.test');
  });

  it('has no repository: reaching it as rows refuses the boot', async () => {
    await expect(booting(valuesOf({ meili: { url: 'https://meili.test', key: 'k' } }), {
      entities: [Meili],
      providers: [{ ctor: MeiliRepository, repository: Meili }],
    })).rejects.toThrow(/MeiliRepository reaches Meili as rows, and Meili is held as one value/);
  });

  it('refuses an entity held as rows asked for as one value', async () => {
    await expect(booting(valuesOf({}), {
      entities: [Post],
      handlers: [{ ctor: PostHandler, deps: ['Post'], operations: { list: op({ cardinality: 'page' }) } }],
    })).rejects.toThrow(/PostHandler asks for Post as one value, and Post is held as rows/);
  });
});
