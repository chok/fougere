import { createServer, type Server } from 'node:http';
import type { CallRecord } from '@fougere/core';
import type { CallRing } from './CallRing.js';
import { page } from './page.js';

export interface PanelOptions {
  /** The port to listen on. `0` takes whatever is free and prints it. */
  port?: number;
  /** What the page calls itself, and what a reader recognises in a browser tab. */
  title?: string;
  /** The fronds this process hosts, shown beside the title. */
  fronds?: string[];
  /** What this process serves — read once at boot, since a boot does not change it. */
  model?: unknown;
  /** The three other rings, each answering what a reader has not seen. */
  logs?: (cursor: number) => unknown;
  errors?: (cursor: number) => unknown;
  queries?: (cursor: number) => unknown;
  /** In flight, right now — asked at each beat rather than held. */
  inFlight?: () => number;
  /** Told where it is listening, once. */
  announce?: (url: string) => void;
}

/** How often the page is told how many calls are in flight. */
const BEAT_MS = 1000;

/** Serves the panel and returns how to close it. */
export function servePanel(ring: CallRing, options: PanelOptions = {}): Promise<() => Promise<void>> {
  const title = options.title ?? 'fougere';
  const readers = new Set<{ write: (chunk: string) => void; end: () => void }>();
  const html = page(title);

  const send = (event: string, data: unknown): void => {
    const framed = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reader of readers) {
      try { reader.write(framed); } catch { readers.delete(reader); }
    }
  };

  const stopWatching = ring.watch((record: CallRecord) => send('call', record));
  const beat = setInterval(() => {
    if (readers.size === 0) return;
    send('vitals', { inFlight: options.inFlight?.() ?? 0, dropped: ring.since(Number.MAX_SAFE_INTEGER).dropped });
  }, BEAT_MS);
  beat.unref();

  const server: Server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0];

    if (path === '/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      // The page is handed the ring as it stands, so a reader that opens late is not
      // looking at an empty screen that suggests a quiet app.
      const backlog = ring.since(0);
      response.write(`event: hello\ndata: ${JSON.stringify({ calls: backlog.calls, fronds: options.fronds ?? [] })}\n\n`);
      readers.add(response);
      request.on('close', () => readers.delete(response));
      return;
    }

    // One door per ring, each taking a cursor: a reader asks for what is above its own,
    // which is the whole protocol — no subscription to hold, nothing to replay.
    for (const [name, read] of [['logs', options.logs], ['errors', options.errors], ['queries', options.queries]] as const) {
      if (path !== `/${name}.json`) continue;
      const since = Number(new URL(request.url ?? '/', 'http://panel').searchParams.get('since') ?? 0);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(read?.(Number.isFinite(since) ? since : 0) ?? { lines: [], cursor: 0, dropped: 0 }));
      return;
    }

    if (path === '/model.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(options.model ?? { fronds: [] }));
      return;
    }

    if (path === '/calls.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(ring.since(0)));
      return;
    }

    if (path === '/' || path === '/index.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('the panel serves /, /events, /calls.json, /model.json, /logs.json, /errors.json and /queries.json\n');
  });

  return new Promise((ready, refuse) => {
    server.on('error', refuse);
    // Loopback only. This door has no validator — `serve()` refuses to start beyond loopback
    // without `verify`, and this one would not know how to refuse at all.
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      options.announce?.(`http://127.0.0.1:${port}`);

      ready(async () => {
        clearInterval(beat);
        stopWatching();
        for (const reader of readers) { try { reader.end(); } catch { /* going away */ } }
        readers.clear();
        await new Promise<void>((closed) => server.close(() => closed()));
      });
    });
  });
}
