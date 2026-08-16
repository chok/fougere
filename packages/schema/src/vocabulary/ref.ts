import { toTargetThunk, type EntityConstructor } from '../axis/Role.js';
import { Field } from '../Field.js';

export interface RefOptions {
  cascade?: boolean;
}

/**
 * A reference to another entity — a foreign-key string plus a one-relation role.
 * Pass the target class (`ref(Author)`) or, for circular/forward references, a
 * thunk (`ref(() => Author)`). For a nullable FK, wrap it: `optional(ref(Author))`
 * — that path also flips the type to `string | null` (which `ref` alone never did).
 */
export function ref<E extends EntityConstructor>(target: E | (() => E), opts?: RefOptions): Field<string> {
  return new Field<string>({
    shape: { type: 'string' },
    role: {
      relation: {
        to: toTargetThunk(target),
        kind: 'one',
        onDelete: opts?.cascade ? 'cascade' : undefined,
      },
    },
  });
}
