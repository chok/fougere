import { Registry } from '@fougere/registry';
import type { FormatPredicate } from './FormatPredicate.js';

/**
 * The string formats the engine does not know.
 * Ex: `StringFormats.register('siret', (v) => /^\d{14}$/.test(v))`.
 */
export const StringFormats = new Registry<FormatPredicate>('format');
