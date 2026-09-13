import { Registry } from '../../lib/Registry.js';
import type { FormatPredicate } from './FormatPredicate.js';

/**
 * String formats the JSON Schema engine does not know. `find` answers `undefined` for
 * `email` or `uuid`, which it validates on its own.
 * FR : les formats de chaîne que le moteur ignore ; `find` rend `undefined` pour les siens.
 * `Formats.register('siret', (v) => /^\d{14}$/.test(v))`
 */
export const Formats = new Registry<FormatPredicate>('format');
