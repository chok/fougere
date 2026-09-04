/** Rows in a Map — the source that ships no driver, in the ten lines the frame leaves. */
import { Sources, storageOver, type Row, type Rows, type Source, type SourceConfig } from '@fougere/core';

/** One entity's rows. Held for the life of the process, released with nothing to close. */
function mapRows(): Rows {
  const store = new Map<string, Row>();

  return {
    client: store,
    get: async (key) => store.get(key),
    has: async (key) => store.has(key),
    set: async (key, row) => { store.set(key, row); },
    delete: async (key) => store.delete(key),
    all: async () => [...store.values()],
  };
}

/** The whole port over a Map, per entity. */
export const createMemoryStorage = storageOver(() => mapRows());

export function setupMemory(): Source {
  return { storageFactory: createMemoryStorage, name: 'memory' };
}

Sources.register('memory', (_conf: SourceConfig): Source => setupMemory());
