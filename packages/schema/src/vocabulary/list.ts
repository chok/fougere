import { Field } from '../Field.js';

export interface ListOptions {
  min?: number;
  max?: number;
}

export function list<T>(item: Field<T>, opts?: ListOptions): Field<T[]> {
  if (item.role?.relation) throw new Error('list() takes a value field (text(), number()…) — a relation has no value shape');
  return new Field<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  });
}
