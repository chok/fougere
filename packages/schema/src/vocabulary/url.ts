import { text, type TextOptions } from './text.js';
import type { Field } from '../field/Field.js';

/**
 * So a URL is a text with a stated format, not a type of its own.
 * FR : pour qu'une URL soit un texte au format énoncé, pas un type à part.
 * `url()` → `{ type: 'string', format: 'uri' }`
 */
export function url(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'uri' });
}
