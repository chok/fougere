import { createField, type Field } from '../field/index.js';

interface OneOfOptions {
  description?: string;
  /** Value filled at create when the input omits the field (same as text/number/bool). */
  default?: string;
}

export function oneOf<const T extends readonly string[]>(
  ...args: [...T] | [...T, OneOfOptions]
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
