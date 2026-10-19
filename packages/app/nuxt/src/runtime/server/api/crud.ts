/** REST catch-all — the h3 half of a facade whose decisions live in `@fougere/app`. */
import { defineEventHandler, getQuery, getRequestHeaders, createError, setResponseStatus, setResponseHeaders, toWebRequest } from 'h3';
import { jsonBodyOf, serveRest, useFougereApp } from '@fougere/app';
import { stateOf } from '../stateOf.js';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();

  const method = event.method.toUpperCase();
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

  const outcome = await serveRest(app, {
    method,
    path: event.path.replace(/\?.*$/, ''),
    query: getQuery(event) as Record<string, string>,
    headers: new Headers(Object.entries(getRequestHeaders(event)).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    body: async () => (hasBody ? jsonBodyOf(toWebRequest(event)) : undefined),
    state: stateOf(event),
  });

  if (outcome.kind === 'pass') {
    throw createError({ statusCode: 404, message: `No route for ${method} ${event.path}` });
  }

  if (outcome.kind === 'error') {
    if (outcome.headers) setResponseHeaders(event, outcome.headers);
    throw createError({
      statusCode: outcome.status,
      message: outcome.body.message,
      data: outcome.body,
    });
  }

  if (outcome.headers) setResponseHeaders(event, outcome.headers);
  setResponseStatus(event, outcome.status);

  return outcome.body;
});
