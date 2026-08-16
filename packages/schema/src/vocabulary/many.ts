import { toTargetThunk, type EntityConstructor } from '../axis/role/Relation.js';
import { Field } from '../Field.js';

/**
 * A collection of related entities — `many(Post)`, or `many(() => Post)` for a cycle.
 * Shape `array` without `items`: the element shape lives on the other side, named by the role.
 */
export function many<E extends EntityConstructor>(target: E | (() => E)): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: { to: toTargetThunk(target), kind: 'many' } },
  });
}
