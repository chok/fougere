import { createField, type Field } from '../field/index.js';

export function bool(opts?: { default?: boolean; description?: string }): Field<boolean> {
  return createField<boolean>({
    shape: { type: 'boolean' },
    lifecycle: opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
