import {
  answerAt,
  createAppRunner,
  callValueOf,
  ErrorCode,
  FougereError,
  serves,
  type App,
  type BootRefusal,
  type FrondCall,
  type InvocationContext,
} from '@fougere/core';
import { pageDoor, PARSE_ERROR } from '@fougere/transport-http';
import type { HttpCarrier } from '@fougere/http';
import { describedAt, restDoor } from '@fougere/adapter-rest';
import { matchRoute, tableOf } from './RouteMatch.js';
import type { DoorRequest } from './DoorRequest.js';

/** What a host must write back. `pass` is the one that keeps a facade additive. */
export type Outcome =
  /** Not ours — the host's own routes must still reach their handler. */
  | { kind: 'pass' }
  /** `raw`: the body is written as it is, under the `content-type` it names — a page, not JSON. */
  | { kind: 'ok'; status: number; body: unknown; headers?: Record<string, string | string[]>; raw?: boolean }
  | { kind: 'error'; status: number; body: { message: string } & Record<string, unknown>; headers?: Record<string, string | string[]> };

// ── The call envelope ────────────────────────────

/** The audience this facade serves — the path segment after `/_fougere/call`. */
export function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));

  return named?.[1];
}

/** Receiving end for the browser — the page's door, with the state the host resolved server-side. */
export function serveRpc(
  app: App,
  request: { path: string; body: unknown; state: Record<string, unknown>; carrier?: HttpCarrier },
): Promise<unknown> {
  const surface = surfaceOf(request.path);

  return app.answer(pageDoor(createAppRunner(app, surface), {
    state: request.state,
    carrier: request.carrier,
    listens: (address, op) => app.listens(address, op),
  }), request.body);
}

/**
 * Every call while the boot is refused, framed like any refused op so a page shows it where it
 * shows one. Its words name tables and columns, so they leave the process only when `disclosed`.
 */
export function refusedRpc(refusal: BootRefusal, body: unknown, disclosed: boolean): Promise<unknown> {
  const message = disclosed ? refusal.message : 'The app refused to start.';

  return answerAt(pageDoor(async () => { throw new FougereError({ code: ErrorCode.SERVICE_UNAVAILABLE, message }); }, { state: {} }), body);
}

/** The answer a host returns when it could not even parse the payload. */
export function rpcParseError() {
  return { jsonrpc: '2.0' as const, id: null, error: { code: PARSE_ERROR, message: 'Parse error' } };
}

// ── REST ─────────────────────────────────────────

/**
 * Match the URL against the canonical table, invoke the call it names, shape the result for HTTP.
 */
export async function serveRest(app: App, request: DoorRequest): Promise<Outcome> {
  // The app decides, not the host. A route file may exist and a middleware may be
  // installed; if `fougere.config.ts` does not name `protocols: { rest: {} }`,
  // this serves nothing and the request carries on to whatever the app itself routes.
  if (!serves(app.protocols, 'rest')) return { kind: 'pass' };

  const method = request.method.toUpperCase();
  const described = describedAt(app, method, request.path);
  if (described) return { kind: 'ok', status: described.status, body: described.data, ...(described.headers && { headers: described.headers }), ...(described.raw && { raw: true }) };

  const segments = request.path.split('/').filter(Boolean);
  if (segments.length < 2) return { kind: 'pass' };

  const match = matchRoute(tableOf(app), method, segments);
  if (!match) return { kind: 'pass' };

  if (match.kind === 'method-not-allowed') {
    return {
      kind: 'error',
      status: 405,
      body: {
        message: `Method ${method} not allowed on ${request.path} — try ${match.allow.join(', ')}`,
        allow: match.allow,
      },
      headers: { allow: match.allow.join(', ') },
    };
  }

  const { route, params } = match;
  const { status, data, headers } = await app.answer(restDoor(route), {
    operation: route.operationName,
    headers: request.headers ?? new Headers(),
    params,
    query: request.query,
    body: request.body ?? (async () => undefined),
    state: request.state,
  });
  if (status >= 400) {
    return { kind: 'error', status, body: data as { message: string } & Record<string, unknown>, ...(headers && { headers }) };
  }

  return { kind: 'ok', status, body: data, ...(headers && { headers }) };
}

// ── The server-side dual of the couple ───────────

type EntityClass = { name: string };

type CallInput = Partial<InvocationContext>;

/**
 * Name a call server-side and let the runner place it — local façade → direct in-memory execution,
 * a frond in `remotes` → JSON-RPC on the wire.
 */
export async function invokeOn<T = unknown>(
  app: App,
  target: EntityClass | FrondCall,
  opOrInput?: string | CallInput,
  input?: CallInput,
  state: Record<string, unknown> = {},
): Promise<T> {
  const { call, invocation } = callValueOf(target, opOrInput, input);
  // An explicit `state` on the input wins over the request's — the caller who spells
  // it is answering for it, which is what makes a call outside any request possible.
  const explicit = typeof opOrInput === 'string' ? input : opOrInput;

  return (await createAppRunner(app)(call, { ...invocation, state: explicit?.state ?? state })) as T;
}
