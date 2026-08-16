/**
 * The error vocabulary — what a refusal IS, independently of who hears it.
 *
 * It travels on the wire (`toJSON`/`fromJSON`) and through the browser-safe
 * `@fougere/core/contract`, so nothing here may know about HTTP, a logger, or a
 * middleware chain. Its HTTP reading is one file over, in `http-error.ts`; it used
 * to live in `middleware.ts`, which named the one concept this is not.
 */

// ── ErrorCode ──────────────────────────────────

/** Semantic error codes — transport-agnostic. Each bridge maps them to its own format. */
export enum ErrorCode {
  // Input
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  BAD_REQUEST = 'BAD_REQUEST',

  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  GONE = 'GONE',
  CONFLICT = 'CONFLICT',
  LOCKED = 'LOCKED',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',

  // Limits
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
}

// ── FougereError ────────────────────────────────

export interface FougereErrorOptions {
  code: ErrorCode;
  message: string;
  entity?: string;
  operation?: string;
  details?: unknown;
  cause?: unknown;
}

export class FougereError extends Error {
  readonly code: ErrorCode;
  readonly entity?: string;
  readonly operation?: string;
  readonly details?: unknown;

  constructor(options: FougereErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'FougereError';
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

  /**
   * Dual of toJSON — rebuild a typed error from its wire form.
   *
   * Wire input is untrusted: an unknown code degrades to INTERNAL_ERROR
   * (original code kept in details) instead of forging a fake semantic code.
   */
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
