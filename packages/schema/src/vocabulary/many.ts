import { Relation, type EntityConstructor } from '../schema/axis/role/Relation.js';
import { Field } from '../schema/fields/Field.js';

/**
 * So the other side of a reference is declared, and holds no column.
 * FR : pour que l'autre côté d'une référence soit déclaré, sans porter de colonne.
 * `many(() => Post)` → a collection, absent from the row a client sends
 */
export function many<E extends EntityConstructor>(
  target: E | (() => E),
): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: Relation.many(target) },
  });
}
