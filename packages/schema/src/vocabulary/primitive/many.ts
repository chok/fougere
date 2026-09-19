import { type EntityConstructor } from '../../axis/role/EntityConstructor.js';
import { Relation } from '../../axis/role/Relation.js';
import { Field, type Described } from '../../field/Field.js';

/**
 * `many(() => Post)` → `{ type: 'array' }` with `role.relation.kind` `'many'`
 */
export function many<E extends EntityConstructor>(
  target: E | (() => E),
  opts?: Described,
): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: Relation.many(target) },
  }).setShared(opts);
}
