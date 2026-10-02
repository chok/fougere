import { storageOver, type StorageFactory, type Values } from '../src/index.js';

/** Rows in a Map, one per entity — for a test about something other than where rows live. */
export const memory: StorageFactory = storageOver(() => {
  const map = new Map<string, Values>();

  return {
    client: map,
    get: async (key) => map.get(key),
    has: async (key) => map.has(key),
    set: async (key, values) => { map.set(key, values); },
    delete: async (key) => map.delete(key),
    all: async () => [...map.values()],
  };
});
