/**
 * The three doors as Web-standard handlers: `Request` in, `Response` out.
 *
 * This is the whole server surface for any host built on fetch semantics — Next
 * route handlers, TanStack Start server routes, Hono, a bare `Deno.serve`. Such a
 * host mounts these; it does not translate anything, because there is nothing left
 * to translate.
 *
 * Nuxt is the exception and keeps its own translation, for a reason worth stating:
 * an h3 event is not a `Request`, and reading its body has to straddle two h3
 * majors (`server/routes/call.post.ts` carries that hundred lines). That file is
 * what a NON-Web-standard host costs.
 */
import { serveRest, serveRpc, rpcParseError, useFougereApp, serveGraphQL } from './index.js';
import { MAX_BODY_BYTES } from '@fougere/core';
import { sessionViewOf } from './session.js';
import { stateFor } from './state.js';

const WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * The call envelope. A named surface is the path segment after the door —
 * `/_fougere/call/public` serves the `public` audience — and `surfaceOf` reads it,
 * so a host only has to mount this at a path that keeps the segments.
 */
export async function fougereCall(request: Request): Promise<Response> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ message: 'Payload too large' }, { status: 413 });
  }

  const app = await useFougereApp();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcParseError());
  }

  return Response.json(
    await serveRpc(app, {
      path: new URL(request.url).pathname,
      body,
      state: await stateFor(request.headers),
    }),
  );
}

/**
 * The REST projection, mounted under `/api`.
 *
 * `pass` — a path this app does not serve — becomes a 404 here rather than a
 * fall-through, because a Web handler has nobody to fall through to. Hosts that
 * resolve a static route before a catch-all (Next does) still let an app keep its
 * own `/api/*` handlers: they are reached BEFORE this one, not after.
 */
export async function fougereRest(request: Request): Promise<Response> {
  const app = await useFougereApp();
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  const outcome = await serveRest(app, {
    method,
    path: url.pathname.replace(/^\/api\//, ''),
    query: Object.fromEntries(url.searchParams),
    body: WITH_BODY.has(method) ? await request.json().catch(() => undefined) : undefined,
    state: await stateFor(request.headers),
  });

  if (outcome.kind === 'pass') {
    return Response.json({ message: `No route for ${method} ${url.pathname}` }, { status: 404 });
  }
  if (outcome.kind === 'error') {
    return Response.json(outcome.body, { status: outcome.status, headers: outcome.headers });
  }
  return Response.json(outcome.body, { status: outcome.status });
}

/** The session view over the wire, for a client refreshing after login or logout. */
export async function fougereSession(request: Request): Promise<Response> {
  return Response.json(sessionViewOf(await stateFor(request.headers)));
}

/**
 * GraphQL, at whatever path the host mounted it — `/graphql` by convention.
 *
 * Answers `404` when the app declares no GraphQL adapter, because unlike REST this
 * door is mounted at a path of its own: there is no app route underneath it to pass to.
 */
export async function fougereGraphQL(request: Request): Promise<Response> {
  const app = await useFougereApp();
  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  };

  const outcome = await serveGraphQL(app, {
    ...body,
    surface: new URL(request.url).pathname.split('/').filter(Boolean)[1],
    state: await stateFor(request.headers),
  });

  if (outcome.kind === 'pass') {
    return Response.json({ message: 'GraphQL is not served by this app' }, { status: 404 });
  }
  return Response.json(outcome.body, { status: outcome.status });
}
