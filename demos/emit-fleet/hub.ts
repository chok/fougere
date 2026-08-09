/**
 * The hub. One project, three Fronds — and this process loads two of them.
 *
 * `fronds: ['fleet', 'hub']` is the whole deployment statement. `node` sits on the same
 * disk and is simply not loaded here, so nothing local listens to a `Recalibrate` and the
 * order can only leave through the tunnel. That is what keeps the demo honest.
 *
 * Devices behind a NAT cannot be called, so they call. One socket carries both directions.
 */
import { createServer, type Socket } from 'node:net';
import { createApp, createLocalRunner, setModuleLoader } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';

const PORT = Number(process.env.FLEET_PORT ?? 4500);
const fleet = new Map<Socket, { id: string; topics: Set<string> }>();

function readLines(socket: Socket, onLine: (line: string) => void): void {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let cut: number;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      onLine(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 1);
    }
  });
}

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({
    root: import.meta.dirname,
    createContainer,
    fronds: ['fleet', 'hub'],
    onEmit: (fact, payload) => {
      let reached = 0;
      for (const [socket, { topics }] of fleet) {
        if (!topics.has(fact)) continue;
        socket.write(`${JSON.stringify({ fact, payload })}\n`);
        reached += 1;
      }
      console.log(`\x1b[32m[hub]\x1b[0m ${fact} → ${reached} device(s)`);
    },
  });

  createServer((socket) => {
    readLines(socket, (line) => {
      const msg = JSON.parse(line) as { subscribe?: string[]; id?: string; fact?: string; payload?: unknown };

      // The handshake: a device says who it is and what it accepts, both read off its own
      // code. Nothing here ever sees that code.
      if (msg.subscribe) {
        fleet.set(socket, { id: msg.id ?? '?', topics: new Set(msg.subscribe) });
        console.log(`\x1b[32m[hub]\x1b[0m + ${msg.id} listens to ${msg.subscribe.join(', ')} — ${fleet.size} online`);
        return;
      }

      // Upward. `deliver` and not the emission value: resolving the latter would carry the
      // reading straight back out through `onEmit` and echo it to the whole fleet.
      if (msg.fact) void app.deliver(msg.fact, msg.payload);
    });

    const bye = () => {
      const gone = fleet.get(socket);
      if (gone && fleet.delete(socket)) console.log(`\x1b[32m[hub]\x1b[0m − ${gone.id} — ${fleet.size} online`);
    };
    socket.on('close', bye);
    socket.on('error', bye);
  }).listen(PORT, '127.0.0.1', () => {
    console.log(`\x1b[32m[hub · pid ${process.pid}]\x1b[0m 127.0.0.1:${PORT} — fronds: fleet, hub\n`);
  });

  const run = createLocalRunner(app);
  // `offset` and `node` are primitives, so the binding reads them from params — not body.
  const order = (offset: number, node?: string) =>
    run({ entity: 'fleet', op: 'recalibrate' },
      { params: { offset: String(offset), ...(node ? { node } : {}) }, query: {}, body: undefined, state: {} });

  let turn = 0;
  setInterval(() => {
    turn += 1;
    if (turn % 2) {
      console.log('\n\x1b[1m→ everyone: offset +5\x1b[0m');
      void order(5);
    } else {
      console.log('\n\x1b[1m→ sensor-2 only: offset -3\x1b[0m');
      void order(-3, 'sensor-2');
    }
  }, 7000);
}

main().catch((err) => { console.error(err); process.exit(1); });
