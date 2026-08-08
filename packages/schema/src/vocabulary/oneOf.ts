import { createField, type Field } from '../field/index.js';

interface OneOfOptions<V extends string = string> {
  description?: string;
  /**
   * Value filled at create when the input omits the field (same as text/number/bool).
   *
   * Typed to the members, not to `string`: a default is written into every row without
   * passing the client judge, so `oneOf('draft', 'published', { default: 'typo' })` used
   * to compile and produce rows the entity's own `validate` refuses.
   */
  default?: V;
}

// Two overloads rather than one union: `[...T] | [...T, Options]` let the first branch
// swallow the options object as another member, so the default was never constrained.
export function oneOf<const T extends readonly string[]>(...values: [...T]): Field<T[number]>;
export function oneOf<const T extends readonly string[]>(
  ...args: [...T, OneOfOptions<T[number]>]
): Field<T[number]>;
export function oneOf<const T extends readonly string[]>(
  ...args: [...T] | [...T, OneOfOptions<T[number]>]
): Field<T[number]> {
  const last = args[args.length - 1];
  const hasOpts = typeof last === 'object' && last !== null && !Array.isArray(last);
  const values = (hasOpts ? args.slice(0, -1) : args) as unknown as readonly string[];
  const opts = hasOpts ? (last as OneOfOptions) : {};
  return createField<T[number]>({
    shape: { type: 'string', enum: values },
    lifecycle: opts.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts.description !== undefined ? { description: opts.description } : undefined,
  });
}
