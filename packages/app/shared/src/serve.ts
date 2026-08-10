/**
 * The three doors, decided — and nothing about how a request arrives.
 *
 * A host (Nuxt, Next) owns exactly two translations: read the request into the
 * plain values below, and write the outcome back out. Everything between — which
 * operation a verb and a path name, which audience a segment selects, what a
 * refusal becomes — is decided here, once, for every host.
 *
 * The split matters because the alternative was measured in this repo: two copies
 * of a REST rule drifted until the Nuxt door answered differently from
 * `schema-rest` on the verb, the path AND the exposure. A second host would have
 * been a third copy.
 */
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
  /**
   * The server-resolved session. Stamped by the host from what IT resolved —
   * never taken from the wire, which is the whole trust boundary of the browser
   * door (`transport/http/src/server.ts` carries the same warning for the split).
   */
  state: Record<string, unknown>;
}

/** What a host must write back. `pass` is the one that keeps a door additive. */
export type Outcome =
  /** Not ours — the host's own routes must still reach their handler. */
  | { kind: 'pass' }
  | { kind: 'ok'; status: number; body: unknown }
  | { kind: 'error'; status: number; body: { message: string } & Record<string, unknown>; headers?: Record<string, string> };

// ── The call envelope ────────────────────────────

/**
 * The audience this door serves — the path segment after `/_fougere/call`.
 *
 * The envelope is a surface like REST and GraphQL, so it selects its audience like
 * they do; the difference is only that it takes it from the path instead of an
 * option, because a door is mounted, not called. The same word names the directory
 * (`handlers/public/`), the config key (`surfaces: { public: [...] }`) and this
 * segment — derived, never configured.
 *
 * No escalation to guard: a named surface serves the entities it names and nothing
 * else (closed by naming), so every one of them is a subset of what the bare path
 * already serves.
 */
export function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));
  return named?.[1];
}

/**
 * Receiving end for the browser — same wire as process-to-process (JSON-RPC),
 * different trust boundary: the browser sits outside the topology, so `state` is
 * whatever the host resolved server-side, never what the payload claims.
 *
 * The runner follows the app's topology: local façades and remote doublures alike
 * — the browser never knows where a Frond lives.
 */
export async function serveRpc(app: App, request: Pick<DoorRequest, 'path' | 'body' | 'state'>): Promise<unknown> {
  const runner = createAppRunner(app, surfaceOf(request.path));
  return handleRpc((call, invocation) => runner(call, { ...invocation, state: request.state }), request.body);
}

/** The answer a host returns when it could not even parse the payload. */
export function rpcParseError() {
  return { jsonrpc: '2.0' as const, id: null, error: { code: PARSE_ERROR, message: 'Parse error' } };
}

// ── REST ─────────────────────────────────────────

/**
 * Match the URL against the canonical table, invoke the call it names, shape the
 * result for HTTP. The decision lives in `rest.ts`; dispatch belongs to the runner.
 *
 * `path` is what follows the REST mount point, so `/api/blog/posts/1` arrives as
 * `blog/posts/1`. A path this door does not serve returns `pass`, and that is what
 * lets an app keep its own `/api/*` handlers.
 */
export async function serveRest(app: App, request: DoorRequest): Promise<Outcome> {
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

/**
 * What an operation's return becomes on the wire.
 *
 * Separate from `serveRest` because it is a DECISION and dispatch is not: it can be
 * pinned without a runner, and both hosts get it whether the call ran in memory or
 * came back over JSON-RPC.
 */
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

/**
 * Name a call server-side and let the runner place it — local façade → direct
 * in-memory execution, a frond in `remotes` → JSON-RPC on the wire. The caller
 * never knows which.
 *
 * `state` is explicit here. Each host wraps this with its own way of finding the
 * current request (Nitro's async context, Next's `headers()` scope), because that
 * is the one part a host actually owns.
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
  const given = typeof opOrInput === 'string' ? input : opOrInput;
  return (await createAppRunner(app)(call, { ...invocation, state: given?.state ?? state })) as T;
}
