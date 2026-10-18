import type { Aggregate } from './Aggregate.js';
import { type Entity } from '@fougere/schema';

export type AggregateConstructor<E extends readonly Entity[]> =
  (new (...storages: unknown[]) => Aggregate<E>) & {
    readonly __entity: unknown;
    /** The entities this class owns. Present from two on — an owner of one owns nothing. */
    readonly __owns: E;
  };
