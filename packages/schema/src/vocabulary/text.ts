import { Field } from '../field/Field.js';
import { type StringFormat } from '../axis/shape/Formats.js';

export interface TextOptions {
  min?: number;
  max?: number;
  pattern?: string;
  format?: StringFormat;
  default?: string;
  description?: string;
}

/**
 * So a string field states its bounds where the DDL and the judge both read them.
 * FR : pour qu'un champ texte énonce ses bornes là où le DDL et le juge les lisent.
 * `text({ max: 200, format: 'email' })`
 */
export function text(opts?: TextOptions): Field<string> {
  return new Field<string>({
    shape: {
      type: 'string',
      minLength: opts?.min,
      maxLength: opts?.max,
      pattern: opts?.pattern,
      format: opts?.format,
    },
    lifecycle:
      opts?.default !== undefined ? { create: { value: opts.default } } : undefined,
    meta: opts?.description !== undefined ? { description: opts.description } : undefined,
  });
}
