/**
 * App-level middleware — intercepts handler facade operations.
 *
 * Works regardless of entry point (HTTP, Nitro, event bus, CLI, tests).
 */

// ── Types ───────────────────────────────────────

export interface OperationContext {
  /** Entity name (e.g. 'product'). */
  entity: string;
  /** Operation name (e.g. 'create', 'findById', 'searchByTitle'). */
  operation: string;
  /** Arguments passed to the operation. */
  args: unknown[];
  /** Extensible bag — middlewares deposit data here (user, permissions, etc.). */
  state: Record<string, unknown>;
  /** Transport-agnostic invocation context (params, query, body, state). */
  invocation?: import('./invocation.js').InvocationContext;
}

export type AppNext = () => Promise<unknown>;
export type AppMiddleware = (ctx: OperationContext, next: AppNext) => Promise<unknown>;

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

// ── Runner ──────────────────────────────────────

/**
 * Execute a middleware chain (onion model) then the handler.
 */
export function runMiddlewares(
  middlewares: AppMiddleware[],
  ctx: OperationContext,
  handler: AppNext,
): Promise<unknown> {
  let index = 0;
  const next = (): Promise<unknown> => {
    if (index < middlewares.length) {
      return middlewares[index++](ctx, next);
    }
    return handler();
  };
  return next();
}
