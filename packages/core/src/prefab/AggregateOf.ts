import { type EntityConstructor } from '@fougere/schema';
import type { Storage } from '../storage/Storage.js';

/** The tuple an aggregate holds — the readable form of {@link AggregateShape}'s member. */
export type AggregateOf<E extends readonly EntityConstructor[]> =
  { [K in keyof E]: Storage<InstanceType<E[K]>> };
