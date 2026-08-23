/**
 * The telemetry collector — a Worker, because a Worker is all a receiver needs to be.
 *
 * SigNoz does not run here and cannot: it is ClickHouse plus a collector plus a UI, and
 * an isolate has no persistent process and no local disk. What an isolate CAN be is the
 * thin end: accept OTLP over HTTP, keep the spans in D1, and answer a page. A hosted
 * SigNoz would take the same POST — this exists so the loop closes without an account.
 *
 * It speaks OTLP/HTTP JSON, which is the encoding `@fougere/observability` sends: one
 * POST to /v1/traces carrying `resourceSpans`.
 */
interface Env { DB: D1Database }

const CREATE = `create table if not exists spans (
  trace_id text not null, span_id text not null primary key, parent_id text,
  service text, name text, started_ns integer, ended_ns integer, status text
)`;

const html = (rows: Record<string, unknown>[]) => `<!doctype html><meta charset=utf-8>
<title>Traces</title><style>
body{font:14px/1.6 ui-monospace,monospace;max-width:60rem;margin:3rem auto;padding:0 1.5rem}
td,th{padding:.2em .8em .2em 0;text-align:left}.err{color:#b91c1c}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}</style>
<h1>Traces — ${rows.length} span(s)</h1>
<table><tr><th>trace<th>span<th>parent<th>service<th>operation<th>ms<th>status</tr>
${rows.map((r) => `<tr><td>${String(r.trace_id).slice(0, 8)}<td>${String(r.span_id).slice(0, 8)}
<td>${r.parent_id ? String(r.parent_id).slice(0, 8) : '—'}<td>${r.service}<td>${r.name}
<td>${((Number(r.ended_ns) - Number(r.started_ns)) / 1e6).toFixed(1)}
<td class="${r.status === 'ERROR' ? 'err' : ''}">${r.status}</tr>`).join('')}</table>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await env.DB.prepare(CREATE).run();
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/v1/traces') {
      const body = (await request.json()) as { resourceSpans?: unknown[] };
      const rows: unknown[][] = [];
      for (const resource of body.resourceSpans ?? []) {
        const r = resource as { resource?: { attributes?: { key: string; value: { stringValue?: string } }[] }; scopeSpans?: unknown[] };
        // The service name is a resource ATTRIBUTE in OTLP, never a column of its own.
        const service = r.resource?.attributes?.find((a) => a.key === 'service.name')?.value?.stringValue ?? '?';
        for (const scope of r.scopeSpans ?? []) {
          for (const span of ((scope as { spans?: unknown[] }).spans ?? [])) {
            const s = span as Record<string, any>;
            rows.push([s.traceId, s.spanId, s.parentSpanId ?? null, service, s.name,
              Number(s.startTimeUnixNano ?? 0), Number(s.endTimeUnixNano ?? 0), s.status?.code === 2 ? 'ERROR' : 'OK']);
          }
        }
      }
      // `batch` and not a loop: D1 caps a request at 50 queries, and a trace of any depth
      // arrives as one POST. One statement, many bindings.
      if (rows.length > 0) {
        const insert = env.DB.prepare(
          'insert or replace into spans values (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        await env.DB.batch(rows.map((r) => insert.bind(...r)));
      }
      return new Response(JSON.stringify({ partialSuccess: {} }), { headers: { 'content-type': 'application/json' } });
    }

    // The same rows as JSON, for a page that is not this one. CORS is open because what
    // it serves is a demo's own telemetry — no row of anybody's data reaches it.
    if (url.pathname === '/spans.json') {
      const { results } = await env.DB.prepare(
        'select * from spans order by started_ns desc limit 50',
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }

    const { results } = await env.DB.prepare(
      'select * from spans order by started_ns desc limit 200',
    ).all();
    return new Response(html(results as Record<string, unknown>[]), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },
};
