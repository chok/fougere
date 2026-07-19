import { createField, type Field, type StringFormat } from '../field/index.js';

export interface TextOptions {
  min?: number;
  max?: number;
  pattern?: string;
  /** JSON Schema format predicate (email, uuid, uri, date, time…), asserted by the engine. */
  format?: StringFormat;
  default?: string;
  description?: string;
}

export function text(opts?: TextOptions): Field<string> {
  return createField<string>({
    shape: { type: 'string', minLength: opts?.min, maxLength: opts?.max, pattern: opts?.pattern, format: opts?.format },
    lifecycle: opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
