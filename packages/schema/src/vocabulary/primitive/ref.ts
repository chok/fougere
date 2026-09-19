import { type EntityConstructor } from '../../axis/role/EntityConstructor.js';
import { Relation, type OnDelete } from '../../axis/role/Relation.js';
import { Field, type Shared } from '../../field/Field.js';

export interface RefOptions extends Shared<string> {
  onDelete?: OnDelete;
}

export function ref<E extends EntityConstructor>(
  target: E | (() => E),
  opts?: RefOptions,
): Field<string> {
  return new Field<string>({
    shape: { type: 'string' },
    role: { relation: Relation.one(target, opts?.onDelete) },
  }).setShared(opts);
}
