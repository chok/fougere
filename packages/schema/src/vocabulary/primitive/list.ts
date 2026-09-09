import { Field } from '../../field/Field.js';

export interface ListOptions {
  min?: number;
  max?: number;
}

/**
 * A list of VALUES. The other side of a relation is `many()`, and passing one here throws.
 * FR : une liste de VALEURS. L'autre côté d'une relation est `many()`, et en passer une ici lève.
 * `list(text(), { max: 5 })` → `{ type: 'array', items: { type: 'string' }, maxItems: 5 }`
 */
export function list<T>(item: Field<T>, opts?: ListOptions): Field<T[]> {
  if (item.role?.relation)
    throw new Error(
      'list() takes a value field (text(), number()…) — a relation has no value shape',
    );
  return new Field<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  });
}
