/**
 * REST catch-all — a thin bridge: parse the URL into a call value,
 * invoke it, format the result for HTTP. Dispatch and errors belong to
 * the runner; only static frond metadata is consulted here.
 */
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import { toHttpError } from '@fougere/core';
import { useFougereApp } from '../utils/fougereApp';
import { invoke } from '../utils/invoke';

function pluralize(name: string): string {
  return name.endsWith('y') ? name.slice(0, -1) + 'ies' : name + 's';
}

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();

  // ── parse: /api/{frondName}/{plural}[/{idOrOp}] → FrondCall + invocation
  const path = event.path.replace(/^\/api\//, '').replace(/\?.*$/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return;

  const frond = app.fronds.find((f) => f.name === segments[0]);
  if (!frond) return;
  const entity = frond.entities.find((e) => pluralize(e.name) === segments[1]);
  if (!entity) return;

  const ops = [
    ...(frond.handlers.find((h) => h.entityName === entity.name)?.operations.keys() ?? []),
  ];

  const method = event.method.toUpperCase();
  const extra: string | undefined = segments[2];
  const params: Record<string, string> = {};
  let op: string;

  if (!extra) {
    op = method === 'GET' ? 'list' : 'create';
  } else {
    // /{idOrOp}: kebab-case → camelCase, known operation wins, else it's an id
    const asOp = extra.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    if (ops.includes(asOp)) {
      op = asOp;
    } else {
      params.id = extra;
      if (method === 'GET') op = 'findById';
      else if (method === 'PUT' || method === 'PATCH') op = 'update';
      else if (method === 'DELETE') op = 'delete';
      else throw createError({ statusCode: 405, message: 'Method not allowed' });
    }
  }

  const query = getQuery(event) as Record<string, string>;
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const body = hasBody ? await readBody(event) : undefined;

  // ── invoke: the runner routes it — local façade or remote doublure
  let result: unknown;
  try {
    result = await invoke({ entity: entity.name, op }, { params, query, body });
  } catch (err) {
    const { status, body: payload } = toHttpError(err);
    throw createError({ statusCode: status, message: payload.message, data: payload });
  }

  // ── format
  if (result === null) {
    throw createError({ statusCode: 404, message: 'Not found' });
  }

  // ListResult → serialize as { items, total, hasMore, endCursor }
  if (op === 'list' && Array.isArray(result)) {
    return {
      items: [...result],
      total: (result as any).total,
      hasMore: (result as any).hasMore,
      endCursor: (result as any).endCursor,
    };
  }

  return result;
});
