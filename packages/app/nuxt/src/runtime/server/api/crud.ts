/**
 * REST catch-all — the h3 half of a door whose decisions live in `@fougere/app`.
 *
 * It used to derive its own answers: its own `pluralize`, its own "segment = op or
 * id", and its own method rule — which was no rule at all. A known operation name
 * won whatever the verb, so `GET /api/blog/posts/delete?id=…` reached the mutating
 * method with the session cookie a browser attaches to any navigation, and a
 * body-less `DELETE /api/blog/posts` was read as `create`.
 *
 * `schema-rest` already answers all three in one place, `exposed === false`
 * included — so the fix was not a guard added here, it was the removal of the
 * second answer. `serveRest` is now the third: the same decision serves Next, and
 * neither adapter restates it.
 *
 * What stays here is translation: read the h3 event, write the h3 answer. The state
 * is stamped from `event.context` — what the server resolved, never the wire.
 */
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
