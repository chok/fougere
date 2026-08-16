import { text, type TextOptions } from './text.js';
import type { Field } from '../Field.js';

/** A string holding an email address — `text({ format: 'email' })`, named. */
export function email(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'email' });
}
