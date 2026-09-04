/** The three doors, decided — and nothing about how a request arrives. */
import {
  createAppRunner,
  callValueOf,
  toHttpError,
  type App,
  type FrondCall,
  type InvocationContext,
} from '@fougere/core';
import { handleRpc, PARSE_ERROR } from '@fougere/transport-http';
import { matchRoute, tableOf } from './rest.js';

/** What a host must read off the request before any decision is possible. */
export interface DoorRequest {
  method: string;
  /** Path with no query string. The REST door strips its own `/api` prefix. */
  path: string;
  query: Record<string, string>;
  body?: unknown;
  /** The server-resolved session. */
  state: Record<string, unknown>;
}

/** What a host must write back. `pass` is the one that keeps a door additive. */
export type Outcome =
  /** Not ours — the host's own routes must still reach their handler. */
  | { kind: 'pass' }
  | { kind: 'ok'; status: number; body: unknown }
  | { kind: 'error'; status: number; body: { message: string } & Record<string, unknown>; headers?: Record<string, string> };

// ── The call envelope ────────────────────────────

/** The audience this door serves — the path segment after `/_fougere/call`. */
export function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));
  return named?.[1];
}

/** Receiving end for the browser — same wire as process-to-process (JSON-RPC), different trust bound… */
export async function serveRpc(app: App, request: Pick<DoorRequest, 'path' | 'body' | 'state'>): Promise<unknown> {
  const runner = createAppRunner(app, surfaceOf(request.path));
  return handleRpc((call, invocation) => runner(call, { ...invocation, state: request.state }), request.body);
}

/** The answer a host returns when it could not even parse the payload. */
export function rpcParseError() {
  return { jsonrpc: '2.0' as const, id: null, error: { code: PARSE_ERROR, message: 'Parse error' } };
}

// ── REST ─────────────────────────────────────────

/** Match the URL against the canonical table, invoke the call it names, shape the result for HTTP. */
export async function serveRest(app: App, request: DoorRequest): Promise<Outcome> {
  // The app decides, not the host. A route file may exist and a middleware may be
  // installed; if `fougere.config.ts` does not declare `adapters: { rest: true }`,
  // this serves nothing and the request carries on to whatever the app itself routes.
  if (!app.adapters?.rest) return { kind: 'pass' };

  const segments = request.path.split('/').filter(Boolean);
  if (segments.length < 2) return { kind: 'pass' };

  const method = request.method.toUpperCase();
  const match = matchRoute(tableOf(app), method, segments);
  if (!match) return { kind: 'pass' };

  if (match.kind === 'method-not-allowed') {
    return {
      kind: 'error',
      status: 405,
      body: {
        message: `Method ${method} not allowed on /${request.path} — try ${match.allow.join(', ')}`,
        allow: match.allow,
      },
      headers: { allow: match.allow.join(', ') },
    };
  }

  const { route, params } = match;
  let result: unknown;
  try {
    result = await invokeOn(
      app,
      { entity: route.entityName, op: route.operationName },
      { params, query: request.query, body: request.body },
      undefined,
      request.state,
    );
  } catch (err) {
    const { status, body } = toHttpError(err);
    return { kind: 'error', status, body: body as { message: string } & Record<string, unknown> };
  }

  return shapeRest(route.operationName, result);
}

/** What an operation's return becomes on the wire. */
export function shapeRest(operationName: string, result: unknown): Outcome {
  if (result === null) return { kind: 'error', status: 404, body: { message: 'Not found' } };

  // A list reads as { items, total, hasMore, endCursor } on the wire — the page-level
  // facts ride beside the rows instead of on the array, where JSON drops them.
  if (operationName === 'list' && Array.isArray(result)) {
    const page = result as unknown as { total?: number; hasMore?: boolean; endCursor?: string };
    return {
      kind: 'ok',
      status: 200,
      body: { items: [...result], total: page.total, hasMore: page.hasMore, endCursor: page.endCursor },
    };
  }

  // 200 on every verb, including POST — what the Nuxt door has always answered. A 201
  // would be better REST and is a change of behaviour, so it belongs to `schema-rest`
  // (which owns what a verb means) and not to a refactor that moved this code.
  return { kind: 'ok', status: 200, body: result };
}

// ── The server-side dual of the couple ───────────

type EntityClass = { name: string };
type CallInput = Partial<InvocationContext>;

/** Name a call server-side and let the runner place it — local façade → direct in-memory execution… */
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
