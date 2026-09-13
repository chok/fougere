import type { ValidationError } from '@fougere/schema';
import { ErrorCode } from './ErrorCode.js';
import type { FougereErrorOptions } from './FougereErrorOptions.js';

/**
 * A refusal, and which one — narrowed by the operation that answered it where the caller knows.
 *
 * `Code` defaults to every code there is, so a thrower writes what it always wrote. What it buys
 * is on the READING side: a client generated from a card gets `FougereError<'NOT_FOUND' |
 * 'CONFLICT'>`, and a `switch` over `code` with a `never` in its default stops compiling the day
 * the op learns to refuse something else.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
export class FougereError<Code extends ErrorCode = ErrorCode> extends Error {
  readonly code: Code;
  readonly entity?: string;
  readonly operation?: string;
  readonly details?: unknown;

  constructor(options: FougereErrorOptions<Code>) {
    super(options.message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.entity = options.entity;
    this.operation = options.operation;
    this.details = options.details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.entity && { entity: this.entity }),
      ...(this.operation && { operation: this.operation }),
      ...(this.details !== undefined && { details: this.details }),
    };
  }

  /** Dual of toJSON — rebuild a typed error from its wire form. */
  static fromJSON(json: unknown): FougereError {
    const raw = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>;
    const known = Object.values(ErrorCode).includes(raw.code as ErrorCode);
    return new FougereError({
      code: known ? (raw.code as ErrorCode) : ErrorCode.INTERNAL_ERROR,
      message: typeof raw.message === 'string' ? raw.message : 'Unknown error',
      entity: typeof raw.entity === 'string' ? raw.entity : undefined,
      operation: typeof raw.operation === 'string' ? raw.operation : undefined,
      details: known ? raw.details : { originalCode: raw.code, details: raw.details },
    });
  }
}

/**
 * The refusals behind a VALIDATION_FAILED, or nothing — the ONE place that reads `details` under
 * that code.
 */
export function validationErrorsOf(error: unknown): ValidationError[] | undefined {
  if (!(error instanceof FougereError) || error.code !== ErrorCode.VALIDATION_FAILED) return undefined;
  const { details } = error;
  if (!Array.isArray(details)) return undefined;
  const refusals = details.filter(
    (entry): entry is ValidationError =>
      typeof entry === 'object' && entry !== null
      && Array.isArray((entry as ValidationError).path)
      && typeof (entry as ValidationError).message === 'string',
  );
  return refusals.length === details.length ? refusals : undefined;
}
