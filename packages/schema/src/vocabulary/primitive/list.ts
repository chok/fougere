import { Field, type Shared } from '../../field/Field.js';
import { SchemaError } from '../../SchemaError.js';

export interface ListOptions<T = unknown> extends Shared<T[]> {
  min?: number;
  max?: number;
}

/**
 * A list of values. It keeps the shape of the item and nothing else: `nullable()` and a
 * `description` write in the shape, so they work. A rule writes beside it, and an item of a
 * list has no key, no column and no name to keep it on.
 * `list(text(), { max: 5 })` → `{ type: 'array', items: { type: 'string' }, maxItems: 5 }`
 */
export function list<T>(field: Field<T>, opts?: ListOptions<T>): Field<T[]> {
  if (field.hasAxes)
    throw new SchemaError(
      'list() takes a value, not a rule. Put the rule on the list: unique(list(text())).',
    );

  return new Field<T[]>({
    shape: {
      type: 'array',
      items: field.shape,
      minItems: opts?.min,
      maxItems: opts?.max,
    },
  }).setShared(opts);
}
