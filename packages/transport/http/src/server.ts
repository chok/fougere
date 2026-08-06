/**
 * Receiving half — unframe the call, run it, frame what comes out.
 *
 * Judges nothing: validation and middlewares live with the handler, inside
 * the runner. The error a façade throws is framed whole, never flattened.
 */
import { FougereError, ErrorCode, toPublicError, type InvocationContext, type Transport } from '@fougere/core';
import { APP_ERROR, INVALID_REQUEST, type RpcRequest, type RpcResponse } from './jsonrpc.js';

export async function handleRpc(runner: Transport, raw: unknown): Promise<RpcResponse> {
  const req = raw as Partial<RpcRequest> | null;
  const id = typeof req?.id === 'number' || typeof req?.id === 'string' ? req.id : null;

  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string' || id === null) {
    return { jsonrpc: '2.0', id, error: { code: INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request' } };
  }

  const dot = req.method.indexOf('.');
  if (dot <= 0 || dot === req.method.length - 1) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: INVALID_REQUEST, message: `Invalid method '${req.method}' — expected 'entity.op'` },
    };
  }
  const entity = req.method.slice(0, dot);
  const op = req.method.slice(dot + 1);

  // Fresh objects — middlewares deposit into state, nothing may be shared.
  const sent = (req.params ?? {}) as Partial<InvocationContext>;
  const invocation: InvocationContext = {
    params: sent.params ?? {},
    query: sent.query ?? {},
    body: sent.body,
    state: sent.state ?? {},
  };

  try {
    return { jsonrpc: '2.0', id, result: await runner({ entity, op }, invocation) };
  } catch (err) {
    const failure = err instanceof FougereError
      ? err
      : new FougereError({
          code: ErrorCode.INTERNAL_ERROR,
          message: (err as Error)?.message ?? 'Internal error',
          entity,
          operation: op,
          cause: err,
        });
    const data = toPublicError(failure);
    return { jsonrpc: '2.0', id, error: { code: APP_ERROR, message: data.message, data } };
  }
}
