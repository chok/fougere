import type { Storage } from '../storage/Storage.js';
import type { Entity } from '@fougere/schema';

/** What an aggregate's subclass sees. */
export declare abstract class AggregateShape<E extends readonly Entity[]> {
  protected storages: { [K in keyof E]: Storage<InstanceType<E[K]>> };
}
