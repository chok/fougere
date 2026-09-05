/** A Map — the source that ships no driver, in the ten lines the frame leaves. */
import { Sources, storageOver, type Store, type Values, type Source, type SourceConfig } from '@fougere/core';

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

export function setupMemory(): Source {
  return { storageFactory: createMemoryStorage, name: 'memory' };
}

Sources.register('memory', (_conf: SourceConfig): Source => setupMemory());
