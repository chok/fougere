import { Relation, type EntityConstructor } from '../axis/role/Relation.js';
import { Field } from '../field/Field.js';

export interface RefOptions {
  cascade?: boolean;
}

/**
 * So a reference names the target entity, and the column type follows from it.
 * FR : pour qu'une référence nomme l'entité cible, la colonne en découlant.
 * `ref(() => User, { cascade: true })`
 */
export function ref<E extends EntityConstructor>(
  target: E | (() => E),
  opts?: RefOptions,
): Field<string> {
  return new Field<string>({
    shape: { type: 'string' },
    role: { relation: Relation.one(target, opts?.cascade) },
  });
}
