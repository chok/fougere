import { Field } from '../field/Field.js';

interface OneOfOptions<V extends string = string> {
  description?: string;
  default?: V;
}

export function oneOf<const T extends readonly string[]>(
  ...values: [...T]
): Field<T[number]>;
export function oneOf<const T extends readonly string[]>(
  ...args: [...T, OneOfOptions<T[number]>]
): Field<T[number]>;
/**
 * So the set is in the type and in the CHECK constraint, from one declaration.
 * FR : pour que l'ensemble soit dans le type et dans la contrainte CHECK, d'une déclaration.
 * `oneOf('draft', 'published', { default: 'draft' })`
 */
export function oneOf<const T extends readonly string[]>(
  ...args: [...T] | [...T, OneOfOptions<T[number]>]
): Field<T[number]> {
  const last = args[args.length - 1];
  const hasOpts = typeof last === 'object' && last !== null && !Array.isArray(last);
  const values = (hasOpts ? args.slice(0, -1) : args) as unknown as readonly string[];
  const opts = hasOpts ? (last as OneOfOptions) : {};
  return new Field<T[number]>({
    shape: { type: 'string', enum: values },
    lifecycle:
      opts.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts.description !== undefined ? { description: opts.description } : undefined,
  });
}
