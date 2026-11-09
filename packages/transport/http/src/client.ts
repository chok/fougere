/** Sending half — frame the call, POST it, unframe the result. */
import { FougereError, ErrorCode, maxBodyBytes, maxFrameBytes, type Transport, type FrondCall, type InvocationContext, type SignedCall } from '@fougere/core/contract';
import type { RpcErrorShape } from './jsonrpc/RpcErrorShape.js';
import type { RpcRequest } from './jsonrpc/RpcRequest.js';
import type { RpcResponse } from './jsonrpc/RpcResponse.js';
export type { RpcResponse } from './jsonrpc/RpcResponse.js';

/** Frame a call as a JSON-RPC request. */
export function frameCall(call: FrondCall, invocation: InvocationContext, id: number): RpcRequest {
  return { jsonrpc: '2.0', id, method: `${call.address}.${call.op}`, params: invocation };
}

/** Unframe a JSON-RPC response — the result, or the revived FougereError thrown. */
export function unframeResponse(response: unknown, call: FrondCall): unknown {
  if (!response || typeof response !== 'object' || !('result' in response || 'error' in response)) {
    throw new FougereError({
      code: ErrorCode.BAD_GATEWAY,
      message: 'Answered neither a result nor an error — not a Fougere receiver?',
      address: call.address,
      operation: call.op,
    });
  }
  if ('error' in response) {
    const error = response.error as Partial<RpcErrorShape> | null;
    if (!error || typeof error !== 'object') {
      throw new FougereError({
        code: ErrorCode.BAD_GATEWAY,
        message: 'Answered an error that is not a JSON-RPC error object',
        address: call.address,
        operation: call.op,
      });
    }
    if (error.data !== undefined) throw FougereError.fromJSON(error.data);
    throw new FougereError({
      code: ErrorCode.INTERNAL_ERROR,
      message: `${error.message} (rpc ${error.code})`,
      address: call.address,
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
  /** Signs the state this transport sends, so the receiver can check it. */
  sign?: (call: SignedCall) => Promise<string>;
  /** Who performs the request. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
}

const CONNECTION_FAILURES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

export function createHttpTransport(baseUrl: string, options: HttpTransportOptions = {}): Transport {
  const url = `${baseUrl.replace(/\/$/, '')}/_fougere/call`;
  const send = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 1;
  let nextId = 1;

  return async (call, invocation) => {
    const { caller: _established, fromAnotherProcess: _received, ...forwarded } = invocation;
    const sent = options.sign
      ? { ...forwarded, state: {}, identity: await options.sign({ ...call, ...invocation }) }
      : forwarded;
    const request = frameCall(call, sent, nextId++);
    const body = JSON.stringify(request);
    if (new TextEncoder().encode(body).byteLength > maxFrameBytes()) throw tooLarge(call, baseUrl);

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await send(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (isTimeout(err)) {
          throw new FougereError({
            code: ErrorCode.GATEWAY_TIMEOUT,
            message: `${call.address}.${call.op} timed out after ${timeoutMs}ms`,
            cause: new Error(`${baseUrl} did not answer in ${timeoutMs}ms`),
            address: call.address,
            operation: call.op,
          });
        }
        if (attempt < retries && isConnectionFailure(err)) continue;
        throw new FougereError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `${call.address}.${call.op}: the process serving it is unreachable`,
          address: call.address,
          operation: call.op,
          cause: new Error(`${baseUrl} unreachable: ${(err as Error)?.message ?? err}`, { cause: err }),
        });
      }

      if (res.status === 413) throw tooLarge(call, baseUrl);
      if (!res.ok) {
        throw new FougereError({
          code: ErrorCode.BAD_GATEWAY,
          message: `${call.address}.${call.op}: the receiver answered HTTP ${res.status} — not a Fougere receiver?`,
          cause: new Error(`${baseUrl} answered HTTP ${res.status}`),
          address: call.address,
          operation: call.op,
        });
      }

      let response: RpcResponse;
      try {
        response = (await res.json()) as RpcResponse;
      } catch {
        throw new FougereError({
          code: ErrorCode.BAD_GATEWAY,
          message: `${call.address}.${call.op}: the receiver answered non-JSON`,
          cause: new Error(`${baseUrl} answered non-JSON`),
          address: call.address,
          operation: call.op,
        });
      }

      return unframeResponse(response, call);
    }
  };
}

function tooLarge(call: FrondCall, baseUrl: string): FougereError {
  return new FougereError({
    code: ErrorCode.PAYLOAD_TOO_LARGE,
    message: `${call.address}.${call.op} carries more than the ${maxBodyBytes()} bytes a caller may send (maxBodyBytes).`,
    cause: new Error(`refused for ${baseUrl}`),
    address: call.address,
    operation: call.op,
  });
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

function isConnectionFailure(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;

  return typeof code === 'string' && CONNECTION_FAILURES.has(code);
}
