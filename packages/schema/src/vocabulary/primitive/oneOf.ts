import { Field, type Shared } from '../../field/Field.js';
import type { Shape } from '../../axis/shape/Shape.js';
import { isArrayOf, isObject } from '../../lib/utils.js';
import { SchemaError } from '../../SchemaError.js';
import { admits, judgeOptions } from '../../field/Word.js';

const ADMITS = admits('oneOf', {});

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

  const shape = shapeOf(values);
  if (!shape)
    throw new SchemaError(
      'oneOf() takes strings or numbers, then an optional object of options', { received: given },
    );

  judgeOptions('oneOf', ADMITS, opts);

  return new Field<T[number]>({ shape }).setShared(opts);
}

function shapeOf(values: readonly unknown[]): Shape | undefined {
  if (values.length === 0) return undefined;
  if (isArrayOf(values, (value) => typeof value === 'string')) return { type: 'string', enum: values };
  if (isArrayOf(values, (value) => typeof value === 'number'))
    return { type: values.every(Number.isInteger) ? 'integer' : 'number', enum: values };

  return undefined;
}
