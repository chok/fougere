import { Relation, type EntityConstructor } from '../schema/axis/role/Relation.js';
import { Field } from '../schema/fields/Field.js';

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
