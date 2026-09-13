export interface RpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

/** Application failure — a FougereError, carried in error.data. */
export const APP_ERROR = -32000;

/** Body wasn't JSON (spec-reserved). */
export const PARSE_ERROR = -32700;

/** Not a valid JSON-RPC 2.0 call (spec-reserved). */
export const INVALID_REQUEST = -32600;
