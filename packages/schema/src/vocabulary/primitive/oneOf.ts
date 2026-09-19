import { Field, type Shared } from '../../field/Field.js';

type OneOfOptions<V extends string = string> = Shared<V>;

export function oneOf<const T extends readonly string[]>(
  ...values: [...T]
): Field<T[number]>;
export function oneOf<const T extends readonly string[]>(
  ...args: [...T, OneOfOptions<T[number]>]
): Field<T[number]>;
/**
 * The set travels: GraphQL enum, form `select` and DDL `CHECK`, from this one declaration.
 * FR : l'ensemble voyage : enum GraphQL, `select` du formulaire, `CHECK` du DDL.
 * `oneOf('draft', 'published', { default: 'draft' })` → `{ type: 'string', enum: [...] }`
 */
export function oneOf<const T extends readonly string[]>(
  ...args: [...T] | [...T, OneOfOptions<T[number]>]
): Field<T[number]> {
  const last = args[args.length - 1];
  const hasOpts = typeof last === 'object' && last !== null && !Array.isArray(last);
  const values = (hasOpts ? args.slice(0, -1) : args) as unknown as readonly string[];
  const opts = hasOpts ? (last as OneOfOptions<T[number]>) : {};
  return new Field<T[number]>({ shape: { type: 'string', enum: values } }).setShared(opts);
}
