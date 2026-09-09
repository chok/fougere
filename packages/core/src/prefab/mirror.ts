import type { EntityConstructor } from '@fougere/schema';
import type { Storage } from '../storage.js';

/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Instances written, counting a replaced one once. */
  written: number;
  /** The age the pull was asked to start from — absent when it asked for everything. */
  since?: Date;
  /** How long the whole pass took, pull included. */
  ms: number;
}

/** A paginated local copy of a source that cannot be queried directly. */
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

export interface MirrorConstructor<T> {
  new (storage: Storage<T>): MirrorOf<T>;
  readonly __entity: unknown;
}

export function Mirror<E extends EntityConstructor>(shape: E): MirrorConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  abstract class MirrorBase implements MirrorOf<T> {
    static readonly __entity = shape;

    constructor(public storage: Storage<T>) {}

    abstract pull(since?: Date): AsyncIterable<Partial<T>[]>;

    async refresh(since?: Date): Promise<Refreshed> {
      const started = Date.now();
      let written = 0;
      // Preserve the source's page boundaries: one page becomes one upsert.
      for await (const page of this.pull(since)) {
        if (page.length === 0) continue;
        written += await this.storage.upsertAll(page);
      }

      return { written, since, ms: Date.now() - started };
    }
  }

  return MirrorBase as unknown as MirrorConstructor<T>;
}
