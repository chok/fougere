/** A Map — the source that ships no driver, in the ten lines the frame leaves. */
import { Format, type Accepted } from '@fougere/schema';
import { Sources, storageOver, type Store, type Values, type Source } from '@fougere/core';

/** One entity, held for the life of the process, released with nothing to close. */
function mapStore(): Store {
  const map = new Map<string, Values>();

  return {
    client: map,
    get: async (key) => map.get(key),
    has: async (key) => map.has(key),
    set: async (key, values) => { map.set(key, values); },
    delete: async (key) => map.delete(key),
    all: async () => [...map.values()],
  };
}

/** The whole port over a Map, per entity. */
export const createMemoryStorage = storageOver(() => mapStore());

/**
 * One Map per entity NAME in this source: two fronds declaring `Author` here are two views of the same
 * rows, the way they would be of one SQL table.
 */
export function createMemorySource(): Source {
  const stores = new Map<string, Store>();
  const storageFactory = storageOver((_entity, name) => {
    const store = stores.get(name) ?? mapStore();
    stores.set(name, store);

    return store;
  });

  return { storageFactory, name: 'memory' };
}

const MEMORY = Format.of('source/memory')
  .key('type', Format.tokens(['memory']))
  .needs('type')
  .closed();

declare module '@fougere/core' {
  interface FougereSources {
    memory: Accepted<typeof MEMORY>;
  }
}

Sources.register('memory', { format: MEMORY, open: () => createMemorySource() });
