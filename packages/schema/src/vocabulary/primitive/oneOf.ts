import { Field, type Shared } from '../../field/Field.js';

export function oneOf<const T extends readonly string[]>(
  ...values: [...T]
): Field<T[number]>;

export function oneOf<const T extends readonly string[]>(
  ...args: [...T, Shared<T[number]>]
): Field<T[number]>;

/**
 * `oneOf('draft', 'published', { default: 'draft' })` → `{ type: 'string', enum: [...] }`
 */
export function oneOf<const T extends readonly string[]>(
  ...args: [...T] | [...T, Shared<T[number]>]
): Field<T[number]> {
  const given: readonly (T[number] | Shared<T[number]>)[] = args;

  const values = given.filter((arg): arg is T[number] => typeof arg === 'string');
  const opts = given.find((arg): arg is Shared<T[number]> => typeof arg === 'object');

  return new Field<T[number]>({ shape: { type: 'string', enum: values } }).setShared(
    opts,
  );
}
