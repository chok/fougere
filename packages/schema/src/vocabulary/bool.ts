import { Field } from '../schema/fields/Field.js';

/**
 * So a default is a lifecycle rule, not a value the handler remembers to set.
 * FR : pour qu'un défaut soit une règle de cycle de vie, pas un oubli possible du handler.
 * `bool({ default: false })`
 */
export function bool(opts?: { default?: boolean; description?: string }): Field<boolean> {
  return new Field<boolean>({
    shape: { type: 'boolean' },
    lifecycle:
      opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
