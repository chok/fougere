import { text, type TextOptions } from './text.js';
import type { Field } from '../field/Field.js';

/**
 * So the format is stated once, where everyone would otherwise write the same regex.
 * FR : pour que le format soit énoncé une fois, là où chacun réécrirait la même regex.
 * `email({ max: 254 })`
 */
export function email(opts?: Omit<TextOptions, 'format'>): Field<string> {
  return text({ ...opts, format: 'email' });
}
