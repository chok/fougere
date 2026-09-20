import { Axes } from '../../axis/Axes.js';
import { Field, type Shared } from '../../field/Field.js';
import { SchemaError } from '../../SchemaError.js';

export interface ListOptions<T = unknown> extends Shared<T[]> {
  min?: number;
  max?: number;
}

/**
 * A list of VALUES, and what it keeps of the element is its SHAPE — `nullable()` and a
 * `description` write there, every other rule writes an AXIS beside it, and an element has
 * no axis to hold: it is not written, not read back, and answers to no name of its own.
 * `list(text(), { max: 5 })` → `{ type: 'array', items: { type: 'string' }, maxItems: 5 }`
 */
export function list<T>(item: Field<T>, opts?: ListOptions<T>): Field<T[]> {
  const stated = Axes.names.filter((slot) => item.stated(slot));

  if (stated.length)
    throw new SchemaError(
      `list() takes the shape of an element — ${stated.join(', ')} says nothing of one`,
    );

  return new Field<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  }).setShared(opts);
}
