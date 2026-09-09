import { Relation, type EntityConstructor } from '../../axis/role/Relation.js';
import { Field } from '../../field/Field.js';

/**
 * The far side of a `ref()`: no column of its own, and absent from what a client sends.
 * FR : l'autre côté d'un `ref()` : aucune colonne à lui, et absent de ce qu'un client envoie.
 * `many(() => Post)` → `{ type: 'array' }` with `role.relation.kind` `'many'`
 */
export function many<E extends EntityConstructor>(
  target: E | (() => E),
): Field<InstanceType<E>[]> {
  return new Field<InstanceType<E>[]>({
    shape: { type: 'array' },
    role: { relation: Relation.many(target) },
  });
}
