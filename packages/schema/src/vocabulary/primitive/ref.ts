import { type EntityConstructor } from '../../axis/role/EntityConstructor.js';
import { Relation, type OnDelete } from '../../axis/role/Relation.js';
import { Field } from '../../field/Field.js';

export interface RefOptions {
  /**
   * What becomes of this row when the target's is deleted. `restrict` is the default because
   * it is what a foreign key already does when nothing is stated.
   */
  onDelete?: OnDelete;
}

export function ref<E extends EntityConstructor>(
  target: E | (() => E),
  opts?: RefOptions,
): Field<string> {
  return new Field<string>({
    shape: { type: 'string' },
    role: { relation: Relation.one(target, opts?.onDelete) },
  });
}
