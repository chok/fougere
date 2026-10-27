/** Every door an app opens on HTTP, answered from a Web-standard `Request`. */
import { serveRest, serveRpc, refusedRpc, rpcParseError, useFougereApp, useFougereConfig, serveGraphQL } from './index.js';
import { GRAPHQL_PATH, graphqlSurfaceOf, type GraphQLDocument } from './graphql.js';
import { prefixOf } from '@fougere/adapter-rest';
import { BootRefusal, FougereError, maxBodyBytes, readWithin, type App } from '@fougere/core';
import { jsonBodyOf } from './jsonBody.js';
import { sessionViewOf } from './session.js';
import { stateFor } from './state.js';

const CALL_PATH = '/_fougere/call';
const SESSION_PATH = '/_fougere/session';

/**
 * What the app answers to this request — `undefined` when no door of it is the request's, so a host
 * serving other things beside it answers the rest.
 */
export async function answer(app: App, request: Request): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'POST' && pathname.startsWith(CALL_PATH)) return call(app, request, pathname);
  if (method === 'GET' && pathname === SESSION_PATH) return Response.json(sessionViewOf(await stateFor(request.headers, app)));
  if (method === 'POST' && (pathname === GRAPHQL_PATH || graphqlSurfaceOf(pathname))) return graphql(app, request, pathname);

  return rest(app, request);
}

/**
 * The app's answer, for a host that routes by FILE and hands every request of a route here: the app
 * boots at the first one, and a request no door answers is a 404 that says why.
 */
export async function fougere(request: Request): Promise<Response> {
  const app = await useFougereApp().catch((failure: unknown) => {
    if (failure instanceof BootRefusal) return failure;
    throw failure;
  });
  if (app instanceof BootRefusal) return refused(app, request);

  return (await answer(app, request)) ?? notFound(request);
}

/** Every call while the boot is refused, framed like a refused op; anything else is a 503. */
async function refused(refusal: BootRefusal, request: Request): Promise<Response> {
  console.error(refusal.message);
  const disclosed = process.env.NODE_ENV !== 'production';
  if (!new URL(request.url).pathname.startsWith(CALL_PATH)) {
    return Response.json({ message: disclosed ? refusal.message : 'The app refused to start.' }, { status: 503 });
  }

  return Response.json(await refusedRpc(refusal, await request.json().catch(() => ({})), disclosed));
}

/**
 * A host that routes by FILE mounts a door where the file sits, and a config cannot move a file.
 * Saying so is what keeps a stale route file from reading as an app with no routes.
 */
async function notFound(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === GRAPHQL_PATH || graphqlSurfaceOf(pathname)) {
    return Response.json({ message: 'GraphQL is not served by this app' }, { status: 404 });
  }
  const prefix = prefixOf((await useFougereConfig()).protocols);
  if (!pathname.startsWith('/_fougere/') && !pathname.startsWith(`${prefix}/`)) {
    return Response.json({
      message: `${pathname} is not under the REST prefix ${prefix}. Move the route file that hands it here `
        + `under ${prefix}, or change protocols.rest.prefix.`,
    }, { status: 404 });
  }

  return Response.json({ message: `No route for ${request.method.toUpperCase()} ${pathname}` }, { status: 404 });
}

async function call(app: App, request: Request, pathname: string): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(await readWithin(request.body, maxBodyBytes(), request.headers.get('content-length')));
  } catch (failure) {
    if (failure instanceof FougereError) return Response.json({ message: 'Payload too large' }, { status: 413 });

    return Response.json(rpcParseError());
  }

  const response = new Headers();
  const answered = await serveRpc(app, {
    path: pathname,
    body,
    state: await stateFor(request.headers, app),
    carrier: { request: request.headers, response },
  });

  return Response.json(answered, { headers: response });
}

async function rest(app: App, request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const outcome = await serveRest(app, {
    method: request.method.toUpperCase(),
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: request.headers,
    body: () => jsonBodyOf(request),
    state: await stateFor(request.headers, app),
  });

  if (outcome.kind === 'pass') return undefined;
  const headers = headersOf(outcome.headers);
  // A 204 carries no body, and a Response refuses one it was handed.
  if (outcome.status === 204) return new Response(null, { status: 204, headers });
  if (outcome.kind === 'ok' && outcome.raw) return new Response(outcome.body as string, { status: outcome.status, headers });

  return Response.json(outcome.body, { status: outcome.status, headers });
}

async function graphql(app: App, request: Request, pathname: string): Promise<Response | undefined> {
  const outcome = await serveGraphQL(app, {
    document: async () => (await jsonBodyOf(request)) as GraphQLDocument | undefined,
    surface: graphqlSurfaceOf(pathname),
    state: await stateFor(request.headers, app),
    headers: request.headers,
  });

  if (outcome.kind === 'pass') return undefined;

  return Response.json(outcome.body, { status: outcome.status, headers: headersOf(outcome.headers) });
}

/** A header named twice — `set-cookie` — is appended, never joined. */
function headersOf(written: Record<string, string | string[]> = {}): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(written)) {
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }

  return headers;
}
