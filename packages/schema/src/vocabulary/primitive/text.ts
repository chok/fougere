import { Field, type Shared } from '../../field/Field.js';
import { type StringFormat } from '../../axis/shape/StringFormat.js';

export interface TextOptions extends Shared<string> {
  min?: number;
  max?: number;
  pattern?: string;
  format?: StringFormat;
}

export function text(opts?: TextOptions): Field<string> {
  return new Field<string>({
    shape: {
      type: 'string',
      minLength: opts?.min,
      maxLength: opts?.max,
      pattern: opts?.pattern,
      format: opts?.format,
    },
  }).setShared(opts);
}
