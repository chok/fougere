import { Repository } from './Repository.js';
import type { Refreshed } from './Refreshed.js';

/**
 * `Mirror<BookCard>` — a `Repository<BookCard>` that fills itself from a source that cannot be
 * queried directly. Its author writes `pull`, the pages the source hands out; `refresh(since)` writes
 * every page, and the copy reads like any other rows — `this.list()`. Extended by a handler, the
 * copy and `refresh` are served; in `services/`, by nobody.
 *
 * The mark is the CALLER's: only it knows whether a pass completed, and a pass that throws must not
 * advance it.
 *
 * Documented: [the base](https://fougere.dev/docs/concepts/the-base).
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
