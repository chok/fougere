import type { ValidationError } from './ValidationError.js';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * A path as a message writes it — `addr.street`. One rendering among others, and the
 * reason the value stays segmented: this one cannot be read back.
 */
export const dotted = (path: readonly string[]): string => path.join('.');

/** `#/city/zip` — a JSON Pointer fragment, and `~1`/`~0` are how it spells `/` and `~`. */
export const locationOf = (instanceLocation: string): string[] =>
  instanceLocation
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
