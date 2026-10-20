/** Receiving half — unframe the call, run it, frame what comes out: a door, in JSON-RPC terms. */
import {
  answerAt, FougereError, ErrorCode, type Answering, type Door, type InvocationContext, type SignedCall, type Transport,
} from '@fougere/core/contract';
import { APP_ERROR, INVALID_REQUEST } from './jsonrpc/RpcErrorShape.js';
import { type RpcRequest } from './jsonrpc/RpcRequest.js';
import { type RpcResponse } from './jsonrpc/RpcResponse.js';

/** What a receiver does with the caller's envelope. */
export interface ReceiveOptions {
  /** Establishes who signed, or throws. */
  verify?: (identity: string, presented: SignedCall) => Promise<{ caller: string; state: Record<string, unknown> }>;
  /**
   * Refuse a call carrying no verifiable identity — the whole of "secure by default" at the wire.
   */
  requireIdentity?: boolean;
  /** The app's cycle, which watches the request; a receiver holding only a runner runs it unwatched. */
  answer?: Answering;
}

/** One call, unframed. */
export interface RpcCall {
  address: string;
  op: string;
  invocation: InvocationContext;
}

/**
 * The door a process calls another through. The caller is a peer: its state is established by
 * `verify` when it signed, and the call is marked `crossed` so the receiver does not judge again
 * what the sender's own boundary already judged.
 */
export function peerDoor(runner: Transport, options: ReceiveOptions = {}): Door<unknown, RpcCall, RpcResponse> {
  return {
    name: 'rpc',
    decode: async (raw) => {
      const { address, op, sent } = envelopeOf(raw);

      /** State is ESTABLISHED here, or it is only claimed. */
      let state: Record<string, unknown> = sent.state ?? {};
      let caller: string | undefined;
      if (options.verify && sent.identity) {
        try {
          // What ARRIVED, never what we would rather it had been — the comparison is the point.
          ({ caller, state } = await options.verify(sent.identity, { address, op,
            params: sent.params ?? {},
            query: sent.query ?? {},
            input: sent.input,
            args: sent.args,
            runAt: sent.runAt,
          }));
        } catch (err) {
          throw unauthorized((err as Error)?.message ?? 'unverifiable identity', address, op);
        }
      } else if (options.requireIdentity) {
        throw unauthorized('this receiver takes signed calls only', address, op);
      }

      // Built field by field, never spread from `sent`: everything here is either validated
      // above or carried deliberately, and `caller` is ours to write alone.
      return {
        address,
        op,
        invocation: {
          params: sent.params ?? {},
          query: sent.query ?? {},
          input: sent.input,
          ...(sent.args === undefined ? {} : { args: sent.args }),
          state,
          trace: sent.trace,
          ...(sent.runAt === undefined ? {} : { runAt: sent.runAt }),
          ...(caller ? { caller } : {}),
          crossed: true,
        },
      };
    },
    run: ({ address, op, invocation }) => called(runner, address, op, invocation),
    encode: framed,
  };
}

/**
 * The door a page calls through — the same wire, another trust boundary. The browser sits outside
 * the topology: its state is what the host resolved server-side, never what the payload claims,
 * and nothing it sends is taken as already judged. Nor does it write `args`, which are taken as
 * written — a peer's right — and `[id, draft, { id: 'admin' }]` would hand the handler a user no
 * collector read.
 */
export interface PageDoorOptions {
  /** What the host resolved of the caller, server-side. */
  state: Record<string, unknown>;
  /** The page's own HTTP request — what a cookie-kept state arrives and leaves in, written back by the host. */
  carrier?: unknown;
  /** Whether an announcement calls this op — one a page may not name. */
  listens?: (address: string, op: string) => boolean | Promise<boolean>;
}

export function pageDoor(runner: Transport, { state, carrier, listens }: PageDoorOptions): Door<unknown, RpcCall, RpcResponse> {
  return {
    name: 'rpc',
    ...(carrier !== undefined && { carries: 'http', carrier: () => carrier }),
    decode: async (raw) => {
      const { address, op, sent } = envelopeOf(raw);
      if (sent.args !== undefined) {
        throw new FougereError({
          code: ErrorCode.BAD_REQUEST,
          message: `${address}.${op}: a page sends params, query and input, not \`args\` (only fronds send \`args\`).`,
          address,
          operation: op,
        });
      }
      if (await listens?.(address, op)) {
        throw new FougereError({
          code: ErrorCode.NOT_FOUND,
          message: `${address}.${op} is called by an announcement, never by a page: call the command that announces it.`,
          address,
          operation: op,
        });
      }

      return {
        address,
        op,
        invocation: { params: sent.params ?? {}, query: sent.query ?? {}, input: sent.input, state, trace: sent.trace },
      };
    },
    run: ({ address, op, invocation }) => called(runner, address, op, invocation),
    encode: framed,
  };
}

/** A peer's call, through the app's cycle when the receiver holds one. */
export function handleRpc(runner: Transport, raw: unknown, options: ReceiveOptions = {}): Promise<RpcResponse> {
  const door = peerDoor(runner, options);

  return options.answer ? options.answer(door, raw) : answerAt(door, raw);
}

/**
 * The members a caller may send. `caller` and `crossed` are written by the receiver and never claimed, and
 * a key outside the list is refused by name: `body` used to be dropped, and the call then ran
 * with no input and no validation.
 */
const SENT = {
  params: true, query: true, input: true, args: true, state: true, trace: true, identity: true, runAt: true, caller: false,
  crossed: false,
} satisfies Record<keyof InvocationContext, boolean>;

/** Where a refusal of the envelope itself says which JSON-RPC code it is, rather than an app's. */
const ENVELOPE = 'jsonrpc';

function envelopeOf(raw: unknown): { address: string; op: string; sent: Partial<InvocationContext> } {
  const req = raw as Partial<RpcRequest> | null;
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string' || idOf(raw) === null) {
    throw invalid('Invalid JSON-RPC 2.0 request');
  }

  const dot = req.method.indexOf('.');
  if (dot <= 0 || dot === req.method.length - 1) throw invalid(`Invalid method '${req.method}' — expected 'address.op'`);
  const address = req.method.slice(0, dot);
  const op = req.method.slice(dot + 1);

  // Fresh objects — middlewares deposit into state, nothing may be shared.
  const sent = (req.params ?? {}) as Partial<InvocationContext>;
  const strangers = Object.entries(sent)
    .filter(([key, value]) => value !== undefined && !SENT[key as keyof InvocationContext])
    .map(([key]) => key);
  if (strangers.length > 0) {
    const admitted = Object.keys(SENT).filter((key) => SENT[key as keyof InvocationContext]);
    throw new FougereError({
      code: ErrorCode.BAD_REQUEST,
      message: `Unknown invocation member ${strangers.map((key) => `'${key}'`).join(', ')} — one of ${admitted.join(', ')}.`,
      address,
      operation: op,
    });
  }

  return { address, op, sent };
}

/** An accident names the op it happened in, so the receiver's log says where. */
async function called(runner: Transport, address: string, op: string, invocation: InvocationContext): Promise<unknown> {
  try {
    return await runner({ address, op }, invocation);
  } catch (err) {
    if (err instanceof FougereError) throw err;
    throw new FougereError({
      code: ErrorCode.INTERNAL_ERROR, message: (err as Error)?.message ?? 'Internal error', address, operation: op, cause: err,
    });
  }
}

function framed(outcome: { answered: unknown } | { refused: FougereError }, raw: unknown): RpcResponse {
  const id = idOf(raw);
  if ('answered' in outcome) return { jsonrpc: '2.0', id: id!, result: outcome.answered };

  const { refused } = outcome;
  const envelope = (refused.details as Record<string, unknown> | undefined)?.[ENVELOPE];
  if (typeof envelope === 'number') return { jsonrpc: '2.0', id, error: { code: envelope, message: refused.message } };
  const data = refused.toJSON();

  return { jsonrpc: '2.0', id, error: { code: APP_ERROR, message: data.message, data } };
}

function idOf(raw: unknown): string | number | null {
  const id = (raw as Partial<RpcRequest> | null)?.id;

  return typeof id === 'number' || typeof id === 'string' ? id : null;
}

function invalid(message: string): FougereError {
  return new FougereError({ code: ErrorCode.BAD_REQUEST, message, details: { [ENVELOPE]: INVALID_REQUEST } });
}

/** An admission refusal, framed like any other failure so a caller reads one vocabulary. */
function unauthorized(why: string, address: string, op: string): FougereError {
  return new FougereError({ code: ErrorCode.UNAUTHORIZED, message: `Refused: ${why}`, address, operation: op });
}
