import { Field, type Shared } from '../../field/Field.js';
import type { Shape } from '../../axis/shape/Shape.js';
import { isObject, shown } from '../../lib/utils.js';
import { SchemaError } from '../../SchemaError.js';

type Strings = readonly [string, ...string[]];
type Numbers = readonly [number, ...number[]];
type Values = Strings | Numbers;

const areStrings = (values: readonly unknown[]): values is Strings =>
  values.length > 0 && values.every((value) => typeof value === 'string');

const areNumbers = (values: readonly unknown[]): values is Numbers =>
  values.length > 0 && values.every((value) => typeof value === 'number');

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

  return new Field<T[number]>({ shape: shapeOf(values, given) }).setShared(opts);
}

function shapeOf(values: readonly unknown[], given: readonly unknown[]): Shape {
  if (areStrings(values)) return { type: 'string', enum: values };

  if (areNumbers(values))
    return { type: values.every(Number.isInteger) ? 'integer' : 'number', enum: values };

  throw new SchemaError(
    `oneOf() takes strings or numbers, then an optional object of options — got ${shown(given)}`,
  );
}
