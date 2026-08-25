import { Relation, type EntityConstructor } from '../axis/role/Relation.js';
import { Field } from '../Field.js';

export function many<E extends EntityConstructor>(target: E | (() => E)): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: Relation.many(target) },
  });
}
