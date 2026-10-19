/** The three facades as Web-standard handlers: `Request` in, `Response` out. */
import { serveRest, serveRpc, rpcParseError, useFougereApp, useFougereConfig, serveGraphQL } from './index.js';
import { prefixOf } from '@fougere/adapter-rest';
import { FougereError, maxBodyBytes, readWithin, toHttpError, type App } from '@fougere/core';
import { jsonBodyOf } from './jsonBody.js';
import { sessionViewOf } from './session.js';
import { stateFor } from './state.js';

const WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/** The call envelope. */
export async function call(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(await readWithin(request.body, maxBodyBytes(), request.headers.get('content-length')));
  } catch (failure) {
    if (failure instanceof FougereError) return Response.json({ message: 'Payload too large' }, { status: 413 });

    return Response.json(rpcParseError());
  }

  const app = await useFougereApp();

  return Response.json(
    await serveRpc(app, {
      path: new URL(request.url).pathname,
      body,
      state: await stateFor(request.headers),
    }),
  );
}

/** The REST projection, where `protocols.rest.prefix` mounts it — `/api` unless it says otherwise. */
export async function rest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // A host that routes by FILE mounts this where the file sits, and a config cannot move a file.
  // Saying so is what keeps a stale route file from reading as an app with no routes.
  const prefix = prefixOf((await useFougereConfig()).protocols);
  if (!url.pathname.startsWith(`${prefix}/`)) {
    return Response.json({
      message: `${url.pathname} is not under the REST prefix ${prefix}. Move the route file that calls rest() `
        + `under ${prefix}, or change protocols.rest.prefix.`,
    }, { status: 404 });
  }

  const answered = await restAnswer(await useFougereApp(), request);

  return answered ?? Response.json({ message: `No route for ${method} ${url.pathname}` }, { status: 404 });
}

/**
 * The REST answer of an app to a request — `undefined` when no route of it matches, so whoever
 * serves the app beside other things (`fougere serve`, beside the call envelope) answers the rest.
 */
export async function restAnswer(app: App, request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  let body: unknown;
  try {
    body = WITH_BODY.has(method) ? await jsonBodyOf(request) : undefined;
  } catch (refused) {
    return refusal(refused);
  }

  const outcome = await serveRest(app, {
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body,
    state: await stateFor(request.headers, app),
  });

  if (outcome.kind === 'pass') return undefined;
  if (outcome.kind === 'error') {
    return Response.json(outcome.body, { status: outcome.status, headers: outcome.headers });
  }

  // A 204 carries no body, and a Response refuses one it was handed.
  if (outcome.status === 204) return new Response(null, { status: 204 });

  return Response.json(outcome.body, { status: outcome.status });
}

/** The session view over the wire, for a client refreshing after login or logout. */
export async function session(request: Request): Promise<Response> {
  return Response.json(sessionViewOf(await stateFor(request.headers)));
}

/** GraphQL, at whatever path the host mounted it — `/graphql` by convention. */
export async function graphql(request: Request): Promise<Response> {
  let body: { query?: string; variables?: Record<string, unknown>; operationName?: string };
  try {
    body = (await jsonBodyOf(request) ?? {}) as typeof body;
  } catch (refused) {
    return refusal(refused);
  }

  const app = await useFougereApp();

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

function refusal(refused: unknown): Response {
  const { status, body } = toHttpError(refused);

  return Response.json(body, { status });
}
