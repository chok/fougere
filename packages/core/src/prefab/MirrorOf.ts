import type { Storage } from '../storage/Storage.js';
import type { Refreshed } from './Refreshed.js';

/**
 * A paginated local copy of a source that cannot be queried directly.
 *
 * Documented: [the base](https://fougere.dev/docs/concepts/the-base).
 */
export interface MirrorOf<T> {
  /** The copy's own storage — where a page lands. */
  storage: Storage<T>;
  /** Pages of rows to write. The one thing a mirror's author supplies. */
  pull(since?: Date): AsyncIterable<Partial<T>[]>;
  /**
   * Pull from `since` and write every page. The mark is the CALLER's: only it knows
   * whether a pass completed, and a pass that throws must not advance it.
   */
  refresh(since?: Date): Promise<Refreshed>;
}
