import { type EntityConstructor } from '../../axis/role/EntityConstructor.js';
import { Relation } from '../../axis/role/Relation.js';
import { Field } from '../../field/Field.js';

export interface RefOptions {
  cascade?: boolean;
}

export function ref<E extends EntityConstructor>(
  target: E | (() => E),
  opts?: RefOptions,
): Field<string> {
  return new Field<string>({
    shape: { type: 'string' },
    role: { relation: Relation.one(target, opts?.cascade) },
  });
}
