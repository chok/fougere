/**
 * Receiving half — unframe the call, run it, frame what comes out.
 *
 * Judges nothing: validation and middlewares live with the handler, inside
 * the runner. The error a façade throws is framed whole, never flattened.
 */
import { FougereError, ErrorCode, toPublicError, type InvocationContext, type SignedCall, type Transport } from '@fougere/core/contract';
import { APP_ERROR, INVALID_REQUEST, type RpcRequest, type RpcResponse } from './jsonrpc.js';

/** What a receiver does with the caller's envelope. */
export interface ReceiveOptions {
  /**
   * Establishes who signed, or throws. Supplied rather than built here for the reason
   * the sender's `sign` is: verifying is `node:crypto` and this package carries none.
   * `@fougere/app` wires it from `verifyEnvelope` and the root public key.
   */
  verify?: (identity: string, presented: SignedCall) => Promise<{ caller: string; state: Record<string, unknown> }>;
  /**
   * Refuse a call carrying no verifiable identity — the whole of "secure by default"
   * at the wire. Without it a receiver takes the state it is handed and its only
   * protection is the address it bound.
   */
  requireIdentity?: boolean;
}

export async function handleRpc(runner: Transport, raw: unknown, options: ReceiveOptions = {}): Promise<RpcResponse> {
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

  /**
   * State is ESTABLISHED here, or it is only claimed.
   *
   * `sent.state` is what the caller typed; a verified envelope is what it can prove, and
   * when a verifier is wired the envelope REPLACES the claim rather than enriching it —
   * carrying both would leave every reader downstream choosing between them.
   */
  let state: Record<string, unknown> = sent.state ?? {};
  let caller: string | undefined;
  if (options.verify && sent.identity) {
    try {
      // What ARRIVED, never what we would rather it had been — the comparison is the point.
      ({ caller, state } = await options.verify(sent.identity, {
        entity,
        op,
        params: sent.params ?? {},
        query: sent.query ?? {},
        body: sent.body,
      }));
    } catch (err) {
      return refused(id, (err as Error)?.message ?? 'unverifiable identity', entity, op);
    }
  } else if (options.requireIdentity) {
    return refused(id, 'this receiver takes signed calls only', entity, op);
  }

  // Built field by field, never spread from `sent`: everything here is either judged
  // above or carried deliberately, and `caller` is ours to write alone.
  const invocation: InvocationContext = {
    params: sent.params ?? {},
    query: sent.query ?? {},
    body: sent.body,
    state,
    trace: sent.trace,
    ...(caller ? { caller } : {}),
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

/** An admission refusal, framed like any other failure so a caller reads one vocabulary. */
function refused(id: string | number, why: string, entity: string, op: string): RpcResponse {
  const data = toPublicError(
    new FougereError({ code: ErrorCode.UNAUTHORIZED, message: `Refused: ${why}`, entity, operation: op }),
  );
  return { jsonrpc: '2.0', id, error: { code: APP_ERROR, message: data.message, data } };
}
