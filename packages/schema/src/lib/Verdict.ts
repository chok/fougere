import type { ValidationError } from './ValidationError.js';

/**
 * A field's verdict — the value it admitted, or a refusal whose `path` says where INSIDE the
 * value it happened. That path is optional here and required on a `ValidationError`: a field
 * does not know its own name, so the key is prefixed by whoever iterates the fields.
 */
export type Verdict =
  | { value: unknown }
  | (Omit<ValidationError, 'path'> & { path?: ValidationError['path'] });
