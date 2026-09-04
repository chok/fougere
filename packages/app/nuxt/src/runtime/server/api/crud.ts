/** REST catch-all — the h3 half of a door whose decisions live in `@fougere/app`. */
import { defineEventHandler, readBody, getQuery, createError, setResponseStatus, setResponseHeaders } from 'h3';
import { serveRest, useFougereApp } from '@fougere/app';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();

  const method = event.method.toUpperCase();
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

  const outcome = await serveRest(app, {
    method,
    path: event.path.replace(/^\/api\//, '').replace(/\?.*$/, ''),
    query: getQuery(event) as Record<string, string>,
    body: hasBody ? await readBody(event) : undefined,
    state: (event.context ?? {}) as Record<string, unknown>,
  });

  // Nothing here is ours — an app's own /api/* routes must still reach their handler.
  if (outcome.kind === 'pass') return;

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
