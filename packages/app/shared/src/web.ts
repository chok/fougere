/** Every door an app opens on HTTP, answered from a Web-standard `Request`. */
import {
  answerAt,
  BootRefusal,
  createAppRunner,
  ErrorCode,
  FougereError,
  maxBodyBytes,
  Protocols,
  readWithin,
  serves,
  type App,
  type Door,
} from '@fougere/core';
import { pageDoor, PARSE_ERROR } from '@fougere/transport-http';
import { describedAt, prefixOf, restDoor } from '@fougere/adapter-rest';
import { GRAPHQL_PATH, graphqlSurfaceOf, type GraphQLDocument } from './graphql.js';
import { matchRoute, tableOf } from './RouteMatch.js';
import { useFougereApp, useFougereConfig } from './boot.js';
import { jsonBodyOf } from './jsonBody.js';
import { stateFor } from './state.js';

const CALL_PATH = '/_fougere/call';

export interface AnswerOptions {
  /** Who the caller is, when the host resolved it itself — read off the headers otherwise. */
  state?: Record<string, unknown>;
}

/**
 * What the app answers to this request — `undefined` when no door of it is the request's, so a host
 * serving other things beside it answers the rest.
 */
export async function answer(app: App, request: Request, options: AnswerOptions = {}): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  const state = () => options.state ?? stateFor(request.headers, app);

  if (method === 'POST' && pathname.startsWith(CALL_PATH)) return call(app, request, await state());
  if (method === 'POST' && (pathname === GRAPHQL_PATH || graphqlSurfaceOf(pathname))) return graphql(app, request, await state());

  return rest(app, request, state);
}

/**
 * The app's answer, for a host that routes by FILE and hands every request of a route here: the app
 * boots at the first one, and a request no door answers is a 404 that says why.
 */
export async function fougere(request: Request, options: AnswerOptions = {}): Promise<Response> {
  const app = await useFougereApp().catch((failure: unknown) => {
    if (failure instanceof BootRefusal) return failure;
    throw failure;
  });
  if (app instanceof BootRefusal) return refused(app, request);

  return (await answer(app, request, options)) ?? notFound(request);
}

/** The audience this envelope serves — the path segment after `/_fougere/call`. */
export function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));

  return named?.[1];
}

/**
 * Every call while the boot is refused, framed like any refused op so a page shows it where it
 * shows one. Its words name tables and columns, so they leave the process only outside production.
 */
async function refused(refusal: BootRefusal, request: Request): Promise<Response> {
  console.error(refusal.message);
  const message = process.env.NODE_ENV === 'production' ? 'The app refused to start.' : refusal.message;
  if (!new URL(request.url).pathname.startsWith(CALL_PATH)) return Response.json({ message }, { status: 503 });

  const unavailable = pageDoor(async () => { throw new FougereError({ code: ErrorCode.SERVICE_UNAVAILABLE, message }); }, { state: {} });

  return Response.json(await answerAt(unavailable, await request.json().catch(() => ({}))));
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

/** The page's door, with the state the host resolved server-side. */
async function call(app: App, request: Request, state: Record<string, unknown>): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(await readWithin(request.body, maxBodyBytes(), request.headers.get('content-length')));
  } catch (failure) {
    if (failure instanceof FougereError) return Response.json({ message: 'Payload too large' }, { status: 413 });

    return Response.json({ jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message: 'Parse error' } });
  }

  const response = new Headers();
  const door = pageDoor(createAppRunner(app, surfaceOf(new URL(request.url).pathname)), {
    state,
    carrier: { request: request.headers, response },
    listens: (address, op) => app.listens(address, op),
  });

  return Response.json(await app.answer(door, body), { headers: response });
}

/** The URL matched against the canonical table, the call it names invoked, the result shaped for HTTP. */
async function rest(app: App, request: Request, state: () => Promise<Record<string, unknown>> | Record<string, unknown>): Promise<Response | undefined> {
  // The app decides, not the host: a route file may exist, and if `fougere.config.ts` does not name
  // `protocols: { rest: {} }` this serves nothing and the request carries on to what the app routes.
  if (!serves(app.protocols, 'rest')) return undefined;

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const described = describedAt(app, method, url.pathname);
  if (described) {
    const headers = headersOf(described.headers);
    if (described.raw) return new Response(described.data as string, { status: described.status, headers });

    return Response.json(described.data, { status: described.status, headers });
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return undefined;

  const match = matchRoute(tableOf(app), method, segments);
  if (!match) return undefined;

  if (match.kind === 'method-not-allowed') {
    return Response.json(
      { message: `Method ${method} not allowed on ${url.pathname} — try ${match.allow.join(', ')}`, allow: match.allow },
      { status: 405, headers: { allow: match.allow.join(', ') } },
    );
  }

  const { route, params } = match;
  const { status, data, headers } = await app.answer(restDoor(route), {
    operation: route.operationName,
    headers: request.headers,
    params,
    query: Object.fromEntries(url.searchParams),
    body: () => jsonBodyOf(request),
    state: await state(),
  });
  // A 204 carries no body, and a Response refuses one it was handed.
  if (status === 204) return new Response(null, { status, headers: headersOf(headers) });

  return Response.json(data, { status, headers: headersOf(headers) });
}

type GraphQLDoor = Door<
  { document: () => Promise<GraphQLDocument | undefined>; state: Record<string, unknown>; headers?: Headers },
  unknown,
  { status: number; data: unknown; headers?: Record<string, string | string[]> }
>;

/** The app's own operations, executed through the door the imported adapter registered. */
async function graphql(app: App, request: Request, state: Record<string, unknown>): Promise<Response | undefined> {
  if (!serves(app.protocols, 'graphql')) return undefined;

  const registered = Protocols.resolve('graphql', 'protocols.graphql') as unknown as { door: (app: App, surface?: string) => GraphQLDoor };
  const { status, data, headers } = await app.answer(registered.door(app, graphqlSurfaceOf(new URL(request.url).pathname)), {
    document: async () => (await jsonBodyOf(request)) as GraphQLDocument | undefined,
    state,
    headers: request.headers,
  });
  if (status === 200) return Response.json(data, { status, headers: headersOf(headers) });

  // A request the engine never ran — no query, a body refused — has no result, only its errors.
  const [first] = (data as { errors: { message: string }[] }).errors;

  return Response.json({ message: first!.message, ...(data as Record<string, unknown>) }, { status });
}

/** A header named twice — `set-cookie` — is appended, never joined. */
function headersOf(written: Record<string, string | string[]> = {}): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(written)) {
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }

  return headers;
}
