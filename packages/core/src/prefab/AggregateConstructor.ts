import type { AggregateShape } from './AggregateShape.js';
import { type EntityConstructor } from '@fougere/schema';

export type AggregateConstructor<E extends readonly EntityConstructor[]> =
  (new (...storages: unknown[]) => AggregateShape<E>) & {
    readonly __entity: unknown;
    /** The entities this class owns. Present from two on — an owner of one owns nothing. */
    readonly __owns: E;
  };
