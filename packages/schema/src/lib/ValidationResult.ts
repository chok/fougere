import type { ValidationError } from './ValidationError.js';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * A path written for a message.
 * Ex: `['addr', 'street']` → `addr.street`.
 */
export const dotted = (path: readonly string[]): string => path.join('.');

/** `#/city/zip` — a JSON Pointer fragment, and `~1`/`~0` are how it spells `/` and `~`. */
export const locationOf = (instanceLocation: string): string[] =>
  instanceLocation
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
