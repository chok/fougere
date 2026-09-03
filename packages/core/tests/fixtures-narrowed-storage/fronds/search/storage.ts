import type { Storage } from '../../../../src/storage.js';

/**
 * What an adapter hands back: the port, plus the gesture that engine owns. Ships with the
 * adapter in the real world; local here so the fixture depends on nothing published.
 */
export interface RankedStorage<T> extends Storage<T> {
  search(query: string): Promise<string[]>;
}
