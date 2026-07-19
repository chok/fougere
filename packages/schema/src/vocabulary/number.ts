import { createField, type Field } from '../field/index.js';

export interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  default?: number;
}

export function number(opts?: NumberOptions): Field<number> {
  return createField<number>({
    shape: { type: opts?.integer ? 'integer' : 'number', minimum: opts?.min, maximum: opts?.max },
    lifecycle: opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
  });
}
