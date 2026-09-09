import { text, type TextOptions } from '../primitive/text.js';
import type { Field } from '../../field/Field.js';

export function email(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'email' });
}
