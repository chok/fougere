import type { EntityConstructor } from '@fougere/schema';
import type { Storage } from '../storage/Storage.js';
import type { Refreshed } from './Refreshed.js';
import type { MirrorOf } from './MirrorOf.js';

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
