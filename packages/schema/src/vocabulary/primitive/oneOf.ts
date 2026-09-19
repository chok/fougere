import { Field, type Shared } from '../../field/Field.js';
import { isObject, shown } from '../../lib/utils.js';
import { SchemaError } from '../../SchemaError.js';

type Values = readonly [string, ...string[]];

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
  const values = given.filter((arg): arg is T[number] => typeof arg === 'string');
  const opts = given.find((arg): arg is Shared<T[number]> => isObject(arg));
  const read = opts ? [...values, opts] : values;

  if (values.length === 0 || read.length !== given.length || read.some((arg, index) => arg !== given[index]))
    throw new SchemaError(
      `oneOf() takes one value or more, then an optional object of options — got ${shown(given)}`,
    );

  return new Field<T[number]>({ shape: { type: 'string', enum: values } }).setShared(opts);
}
