import { createField, toTargetThunk, type EntityConstructor, type Field } from '../field/index.js';

/**
 * A collection of related entities — a many-relation role, no value shape of its own.
 * Pass the target class (`many(Post)`) or, for circular/forward references, a thunk
 * (`many(() => Post)`).
 */
export function many<E extends EntityConstructor>(target: E | (() => E)): Field<InstanceType<E>[]> {
  return createField<InstanceType<E>[]>({
    role: { relation: { to: toTargetThunk(target), kind: 'many' } },
  });
}
