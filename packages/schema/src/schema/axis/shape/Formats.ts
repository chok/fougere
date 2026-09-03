import { Registry } from '../../../Registry.js';

export type StringFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'email'
  | 'uuid'
  | 'uri'
  | (string & {});

export type FormatPredicate = (value: string) => boolean;

/**
 * String formats the JSON Schema engine does not know. `find` answers `undefined` for
 * `email` or `uuid`, which it judges on its own.
 * FR : les formats de chaîne que le moteur ignore ; `find` rend `undefined` pour les siens.
 * `Formats.register('siret', (v) => /^\d{14}$/.test(v))`
 */
export const Formats = new Registry<FormatPredicate>(
  'format',
  'call Formats.register(name, predicate)',
);
