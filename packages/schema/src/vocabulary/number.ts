import { Field } from '../schema/fields/Field.js';

export interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  default?: number;
  description?: string;
}

/**
 * So `integer` is a shape, not a second word to remember.
 * FR : pour qu'`integer` soit une forme, pas un second mot à retenir.
 * `number({ integer: true, min: 0 })` → `{ type: 'integer', minimum: 0 }`
 */
export function number(opts?: NumberOptions): Field<number> {
  return new Field<number>({
    shape: {
      type: opts?.integer ? 'integer' : 'number',
      minimum: opts?.min,
      maximum: opts?.max,
    },
    lifecycle:
      opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
