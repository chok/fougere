/** The three doors as Web-standard handlers: `Request` in, `Response` out. */
import { serveRest, serveRpc, rpcParseError, useFougereApp, serveGraphQL } from './index.js';
import { MAX_BODY_BYTES } from '@fougere/core';
import { sessionViewOf } from './session.js';
import { stateFor } from './state.js';

const WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/** The call envelope. */
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

/** The REST projection, mounted under `/api`. */
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

/** GraphQL, at whatever path the host mounted it — `/graphql` by convention. */
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
