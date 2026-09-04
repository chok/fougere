import { Field } from '../field/Field.js';

export interface ListOptions {
  min?: number;
  max?: number;
}

/**
 * So a list of values is told apart from a relation, which `many()` declares.
 * FR : pour qu'une liste de valeurs se distingue d'une relation, que `many()` déclare.
 * `list(text(), { max: 5 })`; `list(ref(User))` → throws
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
