import { Field } from '../field/index.js';

export interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  default?: number;
  description?: string;
}

export function number(opts?: NumberOptions): Field<number> {
  return new Field<number>({
    shape: { type: opts?.integer ? 'integer' : 'number', minimum: opts?.min, maximum: opts?.max },
    lifecycle: opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
