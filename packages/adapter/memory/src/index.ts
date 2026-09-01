/**
 * Rows in a Map — the source that ships no driver, in the ten lines the frame leaves.
 *
 * It is what an app with no `db` runs on, and what a test runs on when the shape is the
 * subject and the engine is not. `storageOver` derives the thirteen gestures from the four
 * below, so nothing about pages, criteria or lifecycle stamps is respelled here — three
 * hand-written copies of this in the demos each answered six of the thirteen, forced the
 * field name `id` and minted a uuid whatever the entity declared.
 *
 * No `transacted`: a Map has no unit of work, so a frame reads the absence and compensates
 * instead of transacting (`boot/together.ts`), saying which of the two it built. No
 * `migrate` either — a Map has no shape to bring up to date.
 */
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
