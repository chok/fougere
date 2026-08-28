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
  /** In flight, right now — asked at each beat rather than held. */
  inFlight?: () => number;
  /** Told where it is listening, once. */
  announce?: (url: string) => void;
}

/** How often the page is told how many calls are in flight. */
const BEAT_MS = 1000;

/**
 * The panel's own door: the page, and the events that fill it.
 *
 * Its own server and not the app's, for one measured reason: `serve()` from
 * `@fougere/transport-http` answers 404 to everything that is not `POST /_fougere/call`,
 * which is what makes it safe to expose — a page cannot enter it without changing what it
 * is. So the panel binds 127.0.0.1 only, and serves both halves itself, which also means
 * the page reads its own origin and no CORS has to be arranged.
 */
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
      const held = ring.since(0);
      response.write(`event: hello\ndata: ${JSON.stringify({ calls: held.calls, fronds: options.fronds ?? [] })}\n\n`);
      readers.add(response);
      request.on('close', () => readers.delete(response));
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
    response.end('the panel serves /, /events, /calls.json and /model.json\n');
  });

  return new Promise((ready, refuse) => {
    server.on('error', refuse);
    // Loopback only. This door has no judge — `serve()` refuses to start beyond loopback
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
