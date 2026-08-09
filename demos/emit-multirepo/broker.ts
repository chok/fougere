/**
 * A stand-in broker, in forty lines — not a product, a way to SEE the mechanism.
 *
 * Real deployments put NATS, Redis or Kafka here. What matters is the shape: subscribers
 * announce the names they listen to, publishers hand a name and a payload, and neither
 * side ever learns anything about the other.
 */
import { createServer, type ServerResponse } from 'node:http';

const PORT = Number(process.env.BROKER_PORT ?? 4300);
const listeners = new Map<ServerResponse, Set<string>>();

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://broker');

  // A subscriber holds the connection open and says WHICH names it wants.
  if (url.pathname === '/subscribe') {
    const topics = new Set((url.searchParams.get('topics') ?? '').split(',').filter(Boolean));
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': ready\n\n');
    listeners.set(res, topics);
    console.log(`\x1b[35m[broker]\x1b[0m + subscriber for ${[...topics].join(', ') || '(nothing)'}`);
    req.on('close', () => listeners.delete(res));
    return;
  }

  if (url.pathname === '/publish' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const { topic, payload } = JSON.parse(raw) as { topic: string; payload: unknown };
      let reached = 0;
      for (const [stream, topics] of listeners) {
        if (!topics.has(topic)) continue;
        stream.write(`data: ${JSON.stringify({ topic, payload })}\n\n`);
        reached += 1;
      }
      console.log(`\x1b[35m[broker]\x1b[0m ${topic} → ${reached} subscriber(s)`);
      res.writeHead(204).end();
    });
    return;
  }

  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\x1b[35m[broker · pid ${process.pid}]\x1b[0m on http://127.0.0.1:${PORT}\n`);
});
