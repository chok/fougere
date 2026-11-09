import { Repository } from './Repository.js';
import type { Refreshed } from './Refreshed.js';

/**
 * A repository that fills itself from a source it cannot query: its author writes `pull`, `refresh(since)` writes every page.
 *
 * Documented: [the base](https://fougere.dev/docs).
 */
export abstract class Mirror<T> extends Repository<T> {
  /** Pages of rows to write. The one thing a mirror's author supplies. */
  abstract pull(since?: Date): AsyncIterable<Partial<T>[]>;

  /** Pull from `since` and write every page — one page, one upsert, as the source cut them. */
  async refresh(since?: Date): Promise<Refreshed> {
    const started = Date.now();
    let written = 0;
    for await (const page of this.pull(since)) {
      if (page.length === 0) continue;
      written += await this.upsertAll(page);
    }

    return { written, ...(since && { since: since.toISOString() }), ms: Date.now() - started };
  }
}
