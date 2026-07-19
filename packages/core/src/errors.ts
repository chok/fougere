/**
 * HTTP error mapping — used by HTTP bridges (REST, Next, Inertia).
 *
 * Not imported by GraphQL, CLI, or event bus bridges.
 */
import { FougereError, ErrorCode } from './middleware.js';

const HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.GONE]: 410,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.LOCKED]: 423,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.PRECONDITION_FAILED]: 412,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.REQUEST_TIMEOUT]: 408,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.BAD_GATEWAY]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
};

/** Map a FougereError code to its HTTP status. */
export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code] ?? 500;
}

/** Map any thrown error to `{ status, body }` for HTTP bridges. */
export function toHttpError(err: unknown): { status: number; body: ReturnType<FougereError['toJSON']> } {
  if (err instanceof FougereError) {
    return { status: httpStatusFor(err.code), body: err.toJSON() };
  }
  return {
    status: 500,
    body: { code: ErrorCode.INTERNAL_ERROR, message: (err as any)?.message ?? 'Internal error' },
  };
}
