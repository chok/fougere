/**
 * JSON-RPC 2.0 framing — the standard written form of a call.
 *
 * The spec is the reuse: these few lines follow it, no lib adds anything.
 * `method` is `entity.op`; `params` is the InvocationContext untouched.
 * A FougereError travels whole in `error.data` (spec keeps `error.code`
 * for integers — the semantic code lives in the data).
 */

export interface RpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

export interface RpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

export type RpcResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: RpcErrorShape };

/** Application failure — a FougereError, carried in error.data. */
export const APP_ERROR = -32000;
/** Body wasn't JSON (spec-reserved). */
export const PARSE_ERROR = -32700;
/** Not a valid JSON-RPC 2.0 call (spec-reserved). */
export const INVALID_REQUEST = -32600;
