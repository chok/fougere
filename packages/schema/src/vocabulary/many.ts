import { toTargetThunk, Field, type EntityConstructor } from '../field/index.js';

/**
 * A collection of related entities. Pass the target class (`many(Post)`) or, for
 * circular/forward references, a thunk (`many(() => Post)`).
 *
 * Its shape is `array` without `items`: the value IS a collection — that much the
 * field states itself — while the element shape lives on the other side, named by
 * the role rather than embedded. This is what the card has always written; saying
 * it here too is what lets every reader take the ordinary path.
 */
export function many<E extends EntityConstructor>(target: E | (() => E)): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: { to: toTargetThunk(target), kind: 'many' } },
  });
}
