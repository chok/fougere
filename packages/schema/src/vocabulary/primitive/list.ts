import { Field, type Shared } from '../../field/Field.js';
import { memberSlots } from '../vocabulary.js';
import { SchemaError } from '../../SchemaError.js';

export interface ListOptions<T = unknown> extends Shared<T[]> {
  min?: number;
  max?: number;
}

/**
 * A list of VALUES, and what it keeps of the element is its SHAPE — `nullable()` writes
 * there, every other rule writes an axis beside it, and an element has no axis to hold.
 * `list(text(), { max: 5 })` → `{ type: 'array', items: { type: 'string' }, maxItems: 5 }`
 */
export function list<T>(item: Field<T>, opts?: ListOptions<T>): Field<T[]> {
  const declared = item as unknown as Record<string, unknown>;
  const stated = memberSlots().filter((slot) => declared[slot]);

  if (stated.length)
    throw new SchemaError(
      `list() takes the shape of an element — ${stated.join(', ')} says nothing of one`,
    );

  return new Field<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  }).setShared(opts);
}
