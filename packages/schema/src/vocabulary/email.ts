import { text, type TextOptions } from './text.js';
import type { Field } from '../schema/fields/Field.js';

export function email(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'email' });
}
