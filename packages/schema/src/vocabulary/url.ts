import { text, type TextOptions } from './text.js';
import type { Field } from '../field/index.js';

/** A string holding a URL — `text({ format: 'uri' })` (JSON Schema's name), named. */
export function url(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'uri' });
}
