import type { ValidationError } from './ValidationError.js';

/** A value admitted, or a refusal saying where inside the value. */
export type Verdict =
  | { value: unknown }
  | (Omit<ValidationError, 'path'> & { path?: ValidationError['path'] });
