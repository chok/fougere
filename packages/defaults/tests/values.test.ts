/**
 * A source holding rows holds values with no code of its own: each one is the `FougereValue` row
 * named after its entity, so the table is what `pending` asks for and `migrate` creates.
 */
import { describe, it, expect } from 'vitest';
import { entity, text, url } from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql';
import { createContainer, type Container } from '@fougere/container';
import { createApp, frond, FougereValue, FOUGERE_VALUE } from '@fougere/core';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

class Meili extends entity({ url: url(), key: text() }) {}
class Book extends entity({ title: text() }) {}
class Search {
  constructor(readonly meili: Meili) {}
}

const app = { fronds: [{ name: 'search', entities: [{ name: 'meili', entityClass: Meili }, { name: 'book', entityClass: Book }] }] };

describe('a value kept in SQL', () => {
  it('asks for its table, and never for a table of the entity itself', async () => {
    const storage = storageFrom({ main: { source: createSqliteSource({ path: ':memory:' }), values: ['Meili'] } });
    const behind = await storage.pending!(app as never);

    expect(behind.join('\n')).toMatch(/fougere_values/);
    expect(behind.join('\n')).toMatch(/books/);
    expect(behind.join('\n')).not.toMatch(/meilis/);
  });

  it('is read from the row named after it', async () => {
    const main = createSqliteSource({ path: ':memory:' });
    const storage = storageFrom({ main: { source: main, values: ['Meili'] } });
    await storage.migrate!(app as never);
    await main.storageFactory(FougereValue, FOUGERE_VALUE).create({ name: 'meili', value: { url: 'https://meili.test', key: 'k' } });

    expect(storage.values!.sourceOf('meili')).toBe('main');
    expect(storage.values!.sourceOf('book')).toBeUndefined();
    expect(await storage.values!.read('meili', Meili)).toEqual({ url: 'https://meili.test', key: 'k' });
    expect(storage.values!.where('meili', Meili, 'url')).toBe("sources.main, the fougereValue row 'meili'");
  });

  it('refuses one value in two sources, which is not built yet', () => {
    expect(() => storageFrom({
      main: { source: createSqliteSource({ path: ':memory:' }), values: ['Meili'] },
      other: { source: createSqliteSource({ path: ':memory:' }), rows: ['Book'], values: ['Meili'] },
    })).toThrow(/'Meili' is listed in the values: of both 'main' and 'other'/);
  });
});

describe('a value, from the config to the constructor', () => {
  it('reaches the class that names it, through the layer a host hands over', async () => {
    const main = createSqliteSource({ path: ':memory:' });
    const storage = storageFrom({ main: { source: main, values: ['Meili'] } });
    const fronds = [frond('search', { entities: [Meili], providers: [{ ctor: Search, deps: ['Meili'] }] })];
    await storage.migrate!({ fronds } as never);
    await main.storageFactory(FougereValue, FOUGERE_VALUE).create({ name: 'meili', value: { url: 'https://meili.test', key: 'k' } });

    await using app = await createApp({ createContainer, fronds, ...layerOf(storage) });
    const search = app.container.resolve<Container>('frond:search').resolve<Search>('Search');

    expect(search.meili).toEqual({ url: 'https://meili.test', key: 'k' });
  });
});
