/**
 * Sending half — frame the call, POST it, unframe the result.
 *
 * Failure vocabulary is FougereError only: a transport failure becomes a
 * typed error (SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT, BAD_GATEWAY), an
 * application failure comes back as the FougereError the façade threw.
 */
import { FougereError, ErrorCode, type Transport, type FrondCall, type InvocationContext } from '@fougere/core/contract';
import type { RpcRequest, RpcResponse } from './jsonrpc.js';
export type { RpcRequest, RpcResponse } from './jsonrpc.js';

/** Frame a call as a JSON-RPC request. */
export function frameCall(call: FrondCall, invocation: InvocationContext, id: number): RpcRequest {
  return { jsonrpc: '2.0', id, method: `${call.entity}.${call.op}`, params: invocation };
}

/** Unframe a JSON-RPC response — the result, or the revived FougereError thrown. */
export function unframeResponse(response: RpcResponse, call: FrondCall): unknown {
  if ('error' in response) {
    if (response.error.data !== undefined) throw FougereError.fromJSON(response.error.data);
    throw new FougereError({
      code: ErrorCode.INTERNAL_ERROR,
      message: `${response.error.message} (rpc ${response.error.code})`,
      entity: call.entity,
      operation: call.op,
    });
  }
  return response.result;
}

export interface HttpTransportOptions {
  /** Abort a call after this long. A timed-out call may have executed — it is never retried. */
  timeoutMs?: number;
  /** Extra attempts on connection failures only — the request provably never left. */
  retries?: number;
}

/** Failures where the request never reached the other side — safe to retry. */
const CONNECTION_FAILURES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

export function createHttpTransport(baseUrl: string, options: HttpTransportOptions = {}): Transport {
  const url = `${baseUrl.replace(/\/$/, '')}/_fougere/call`;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 1;
  let nextId = 1;

  return async (call, invocation) => {
    const request = frameCall(call, invocation, nextId++);

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (isTimeout(err)) {
          throw new FougereError({
            code: ErrorCode.GATEWAY_TIMEOUT,
            message: `${call.entity}.${call.op} timed out after ${timeoutMs}ms (${baseUrl})`,
            entity: call.entity,
            operation: call.op,
          });
        }
        if (attempt < retries && isConnectionFailure(err)) continue;
        throw new FougereError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `${baseUrl} unreachable: ${(err as Error)?.message ?? err}`,
          entity: call.entity,
          operation: call.op,
          cause: err,
        });
      }

      if (!res.ok) {
        throw new FougereError({
          code: ErrorCode.BAD_GATEWAY,
          message: `${baseUrl} answered HTTP ${res.status} — not a Fougere receiver?`,
          entity: call.entity,
          operation: call.op,
        });
      }

      let response: RpcResponse;
      try {
        response = (await res.json()) as RpcResponse;
      } catch {
        throw new FougereError({
          code: ErrorCode.BAD_GATEWAY,
          message: `${baseUrl} answered non-JSON`,
          entity: call.entity,
          operation: call.op,
        });
      }

      return unframeResponse(response, call);
    }
  };
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

function isConnectionFailure(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  return typeof code === 'string' && CONNECTION_FAILURES.has(code);
}
