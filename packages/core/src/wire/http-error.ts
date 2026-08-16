/**
 * HTTP reading of an error — used by HTTP bridges (REST, Next, Inertia).
 *
 * Not imported by GraphQL, CLI, or event bus bridges. The vocabulary it projects
 * is in `errors.ts` and knows nothing of this file.
 */
import { FougereError, ErrorCode } from './errors.js';
import { Logger } from '../builtins/logger.js';
/**
 * An INTERNAL_ERROR is the one class of error whose message never leaves: it was not
 * written for a caller and may quote a path, a query or a row. Masking it is right, and
 * masking it *silently* is how a bug becomes unobservable — the operator loses the same
 * sentence the attacker does. So the mask and the record live in one function: whoever
 * calls `toPublicError` cannot forget the half that keeps the error findable.
 */
const log = new Logger('error');

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
function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code] ?? 500;
}

/**
 * Serialize an application error for an untrusted caller.
 *
 * Every code but INTERNAL_ERROR was written for the caller and travels whole. An
 * INTERNAL_ERROR is replaced by a constant — and logged here, with its cause, so the
 * sentence exists exactly once: on the server.
 */
export function toPublicError(err: FougereError): ReturnType<FougereError['toJSON']> {
  if (err.code !== ErrorCode.INTERNAL_ERROR) return err.toJSON();
  const where = [err.entity, err.operation].filter(Boolean).join('.');
  log.error(`${where || 'internal'}: ${err.message}`, err.cause ?? err);
  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Internal error',
    ...(err.entity && { entity: err.entity }),
    ...(err.operation && { operation: err.operation }),
  };
}

/** Map any thrown error to `{ status, body }` for HTTP bridges. */
export function toHttpError(err: unknown): { status: number; body: ReturnType<FougereError['toJSON']> } {
  if (err instanceof FougereError) {
    return { status: httpStatusFor(err.code), body: toPublicError(err) };
  }
  // A throw that never became a FougereError is masked by the same rule, so it goes
  // through the same door rather than growing a second, quieter one here.
  const framed = new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message: (err as { message?: string })?.message ?? 'Internal error',
    cause: err,
  });
  return { status: 500, body: toPublicError(framed) };
}
