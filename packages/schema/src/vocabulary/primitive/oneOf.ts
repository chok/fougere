import { Field, type Shared } from '../../field/Field.js';
import type { Shape } from '../../axis/shape/Shape.js';
import { isArrayOf, isObject } from '../../lib/utils.js';
import { SchemaError } from '../../SchemaError.js';

type Values = readonly [string, ...string[]] | readonly [number, ...number[]];

export function oneOf<const T extends Values>(...values: [...T]): Field<T[number]>;

export function oneOf<const T extends Values>(
  ...args: [...T, Shared<T[number]>]
): Field<T[number]>;

/**
 * `oneOf('draft', 'published', { default: 'draft' })` → `{ type: 'string', enum: [...] }`
 */
export function oneOf<const T extends Values>(
  ...args: [...T] | [...T, Shared<T[number]>]
): Field<T[number]> {
  const given: readonly unknown[] = args;
  const last = given.at(-1);

  const opts = isObject(last) ? last : undefined;
  const values = opts ? given.slice(0, -1) : given;

  let shape: Shape | undefined = undefined;

  if (values.length === 0)
    throw new SchemaError(
      'oneOf() takes strings or numbers, then an optional object of options', { received: given },
    );

  if (isArrayOf(values, (value) => typeof value === 'string'))
    shape = { type: 'string', enum: values };

  if (isArrayOf(values, (value) => typeof value === 'number'))
    shape = {
      type: values.every(Number.isInteger) ? 'integer' : 'number',
      enum: values,
    };

  if (shape === undefined)
    throw new SchemaError(
      'oneOf() takes strings or numbers, then an optional object of options', { received: given },
    );

  return new Field<T[number]>({ shape }).setShared(opts);
}
