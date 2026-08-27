/**
 * A stand-in broker — not a product, a way to SEE where durability actually lives.
 *
 * Real deployments put NATS, Redis or Kafka here. What matters is the shape, and the shape
 * has three parts, none of them inside Fougere:
 *
 *   1. a LOG   — facts are kept after they are sent;
 *   2. a CURSOR per subscriber — named, so it survives the process that read it;
 *   3. an ACK  — the subscriber says it handled the fact, and only then does the cursor move.
 *
 * That is the whole of at-least-once, and it is why `app.deliver()` must be able to fail:
 * a subscriber that cannot refuse can only ack blindly, and a broker that is always acked
 * has a log nobody ever rewinds.
 */
import { createServer, type ServerResponse } from 'node:http';

const PORT = Number(process.env.BROKER_PORT ?? 4300);

/** The log. In a real broker this is on disk; here it is an array, and that is the only lie. */
const log: { seq: number; topic: string; payload: unknown }[] = [];
/** Where each NAMED subscriber got to. Survives its process, which is the point. */
const cursor = new Map<string, number>();
const live = new Map<ServerResponse, { name: string; topics: Set<string> }>();

const send = (stream: ServerResponse, entry: { seq: number; topic: string; payload: unknown }) =>
  stream.write(`data: ${JSON.stringify(entry)}\n\n`);

const body = (req: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
  });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://broker');

  // A subscriber holds the connection open, says WHO it is and WHICH names it wants.
  if (url.pathname === '/subscribe') {
    const name = url.searchParams.get('name') ?? 'anonymous';
    const topics = new Set((url.searchParams.get('topics') ?? '').split(',').filter(Boolean));
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': ready\n\n');
    live.set(res, { name, topics });

    // The catch-up. Everything it never acked, in order, before a single live fact.
    const from = cursor.get(name) ?? 0;
    const missed = log.filter((entry) => entry.seq > from && topics.has(entry.topic));
    console.log(`\x1b[35m[broker]\x1b[0m + ${name} for ${[...topics].join(', ') || '(nothing)'}`
      + (missed.length ? ` — replaying ${missed.length} it never acked` : ''));
    for (const entry of missed) send(res, entry);

    req.on('close', () => live.delete(res));
    return;
  }

  if (url.pathname === '/publish' && req.method === 'POST') {
    const { topic, payload } = JSON.parse(await body(req)) as { topic: string; payload: unknown };
    const entry = { seq: log.length + 1, topic, payload };
    log.push(entry);

    let reached = 0;
    for (const [stream, { topics }] of live) {
      if (!topics.has(topic)) continue;
      send(stream, entry);
      reached += 1;
    }
    // Kept either way. That sentence is the difference between this and the version of
    // this file that held nothing: `reached === 0` is no longer a fact lost.
    console.log(`\x1b[35m[broker]\x1b[0m #${entry.seq} ${topic} → ${reached} online, kept in the log`);
    res.writeHead(204).end();
    return;
  }

  // Only a handled fact moves a cursor. A subscriber that refused simply does not call
  // this, and gets the fact again the next time it connects.
  if (url.pathname === '/ack' && req.method === 'POST') {
    const { name, seq } = JSON.parse(await body(req)) as { name: string; seq: number };
    if (seq > (cursor.get(name) ?? 0)) cursor.set(name, seq);
    console.log(`\x1b[35m[broker]\x1b[0m   ${name} acked #${seq}`);
    res.writeHead(204).end();
    return;
  }

  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\x1b[35m[broker · pid ${process.pid}]\x1b[0m on http://127.0.0.1:${PORT} — log + cursors\n`);
});
