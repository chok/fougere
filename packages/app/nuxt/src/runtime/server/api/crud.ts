/**
 * REST catch-all — a thin bridge: match the URL against the canonical table, invoke the
 * call it names, format the result for HTTP. The decision lives in `restRoutes`; dispatch
 * and errors belong to the runner.
 *
 * It used to derive its own answers: its own `pluralize`, its own "segment = op or id",
 * and its own method rule — which was no rule at all. A known operation name won whatever
 * the verb, so `GET /api/blog/posts/delete?id=…` reached the mutating method with the
 * session cookie a browser attaches to any navigation, and a body-less `DELETE
 * /api/blog/posts` was read as `create`.
 *
 * `schema-rest` already answers all three in one place, `exposed === false` included — so
 * the fix is not a guard added here, it is the removal of the second answer.
 *
 * What stays local is DISPATCH: the table's `route.handler` is the local façade, and this
 * door must follow the topology, so the call still goes through `invoke` — a frond in
 * `remotes:` answers over JSON-RPC exactly as before.
 */
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import { toHttpError } from '@fougere/core';
import { useFougereApp } from '../utils/fougereApp';
import { invoke } from '../utils/invoke';
import { matchRoute, tableOf } from '../utils/restRoutes';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();

  const path = event.path.replace(/^\/api\//, '').replace(/\?.*$/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return;

  const method = event.method.toUpperCase();
  const match = matchRoute(tableOf(app), method, segments);

  // Nothing here is ours — an app's own /api/* routes must still reach their handler.
  if (!match) return;

  if (match.kind === 'method-not-allowed') {
    throw createError({
      statusCode: 405,
      message: `Method ${method} not allowed on /${path} — try ${match.allow.join(', ')}`,
      data: { allow: match.allow },
    });
  }

  const { route, params } = match;
  const query = getQuery(event) as Record<string, string>;
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const body = hasBody ? await readBody(event) : undefined;

  // ── invoke: the runner routes it — local façade or remote doublure
  let result: unknown;
  try {
    result = await invoke({ entity: route.entityName, op: route.operationName }, { params, query, body });
  } catch (err) {
    const { status, body: payload } = toHttpError(err);
    throw createError({ statusCode: status, message: payload.message, data: payload });
  }

  // ── format
  if (result === null) {
    throw createError({ statusCode: 404, message: 'Not found' });
  }

  // ListResult → serialize as { items, total, hasMore, endCursor }
  if (route.operationName === 'list' && Array.isArray(result)) {
    return {
      items: [...result],
      total: (result as any).total,
      hasMore: (result as any).hasMore,
      endCursor: (result as any).endCursor,
    };
  }

  return result;
});
