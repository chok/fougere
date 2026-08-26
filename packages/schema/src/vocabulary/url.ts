import { text, type TextOptions } from './text.js';
import type { Field } from '../fields/Field.js';

export function url(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'uri' });
}
