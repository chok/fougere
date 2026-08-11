/**
 * Repository A again — same fronds, same `PostHandler`, another carrier.
 *
 * No broker here. This process holds a socket open and pushes facts down it. What it does
 * NOT do is read anyone's code: it learns who listens to what because the listener said so
 * when it connected. That is the whole difference with `emit-split`, where the emitter knew
 * because `search/` was on its own disk.
 *
 * The trade against a broker: fewer moving parts, but the LISTENER must know this address,
 * and nothing is held when the link drops.
 */
import { createServer, type Socket } from 'node:net';
import { createApp, createLocalRunner, setModuleLoader, frondAliases } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';

const PORT = Number(process.env.TUNNEL_PORT ?? 4400);
const listeners = new Map<Socket, Set<string>>();

const inv = (params: Record<string, string>): InvocationContext =>
  ({ params, query: {}, body: undefined, state: {} });

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      let cut: number;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 1);
        // The handshake: the listener announces the names it accepts. It read them off its
        // OWN signatures — this process never sees its code.
        const { subscribe } = JSON.parse(line) as { subscribe: string[] };
        listeners.set(socket, new Set(subscribe));
        console.log(`\x1b[33m[blog · pid ${process.pid}]\x1b[0m a listener introduced itself: ${subscribe.join(', ')}`);
      }
    });
    socket.on('close', () => listeners.delete(socket));
    socket.on('error', () => listeners.delete(socket));
  }).listen(PORT, '127.0.0.1', () => {
    console.log(`\x1b[33m[blog · pid ${process.pid}]\x1b[0m tunnel open on 127.0.0.1:${PORT}`);
    console.log('   waiting for a listener to introduce itself…\n');
  });

  const app = await createApp({
    root: import.meta.dirname,
    createContainer,
    onEmit: (fact, payload) => {
      let reached = 0;
      for (const [socket, topics] of listeners) {
        if (!topics.has(fact)) continue;
        socket.write(`${JSON.stringify({ fact, payload })}\n`);
        reached += 1;
      }
      console.log(`\x1b[33m[blog]\x1b[0m ${fact} → ${reached} listener(s) down the tunnel`);
    },
  });

  // Publish every three seconds, so you can start and stop the listener and watch.
  let n = 0;
  setInterval(() => {
    n += 1;
    void createLocalRunner(app)({ entity: 'post', op: 'publish' }, inv({ id: `p${n}`, title: `Frond number ${n}` }));
  }, 3000);
}

main().catch((err) => { console.error(err); process.exit(1); });
