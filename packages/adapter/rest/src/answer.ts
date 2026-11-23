import { jsonBodyOf, type App } from '@fougere/core';
import { responseOf } from '@fougere/http';
import { describedAt } from './openapi/described.js';
import { restDoor } from './door.js';
import { matchRoute, tableOf } from './routes/RouteMatch.js';

/** What REST answers to the request — its description, then the route its path and method name — or `undefined`. */
export async function answer(app: App, request: Request, state: () => Promise<Record<string, unknown>>): Promise<Response | undefined> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const described = describedAt(app, method, url.pathname);
  if (described) return responseOf(described);

  const match = matchRoute(tableOf(app), method, url.pathname.split('/').filter(Boolean));
  if (!match) return undefined;

  if (match.kind === 'method-not-allowed') {
    return Response.json(
      { message: `Method ${method} not allowed on ${url.pathname} — try ${match.allow.join(', ')}`, allow: match.allow },
      { status: 405, headers: { allow: match.allow.join(', ') } },
    );
  }

  const { route, params } = match;

  return responseOf(await app.answer(restDoor(route), {
    operation: route.operationName,
    headers: request.headers,
    params,
    query: Object.fromEntries(url.searchParams),
    body: () => jsonBodyOf(request),
    state: await state(),
  }));
}
