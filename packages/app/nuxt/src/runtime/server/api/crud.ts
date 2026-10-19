/** REST catch-all — the h3 half of a facade whose decisions live in `@fougere/app`. */
import { defineEventHandler, getQuery, createError, setResponseStatus, setResponseHeaders, toWebRequest } from 'h3';
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

  setResponseStatus(event, outcome.status);

  return outcome.body;
});
