/**
 * One device. Run it three times with a different `NODE_ID`.
 *
 * `fronds: ['fleet', 'node']` — the same project, the other subset. On a Raspberry Pi this
 * is the whole of what gets deployed.
 *
 * It reconnects. Without that, one lost link and the device is deaf until someone walks to
 * it with a keyboard — on a fleet, the difference between a demo and a deployment.
 */
import { connect, type Socket } from 'node:net';
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import type { App } from '@fougere/core';
import { createContainer } from '@fougere/container';

const PORT = Number(process.env.FLEET_PORT ?? 4500);
const ME = process.env.NODE_ID ?? 'sensor-1';

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  let live: Socket | undefined;

  const app: App = await createApp({
    scan: await scanProject(import.meta.dirname, ['fleet', 'node']),
    createContainer,
    // Upward, on the very socket the device opened. A NAT lets nothing in; it lets this out.
    onEmit: (fact, payload) => { live?.write(`${JSON.stringify({ fact, payload })}\n`); },
  });

  /** Reconnect with a backoff that stops growing — a device may be down for hours. */
  const dial = (wait = 500) => {
    const socket = connect(PORT, '127.0.0.1');
    let buffer = '';

    socket.on('connect', () => {
      live = socket;
      // The handshake, derived: `listensTo()` comes off `Fact<Recalibrate>` in the handler.
      socket.write(`${JSON.stringify({ id: ME, subscribe: app.listensTo() })}\n`);
      console.log(`\x1b[36m[${ME}]\x1b[0m connected — listens to ${app.listensTo().join(', ')}`);
    });

    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let cut: number;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        const { fact, payload } = JSON.parse(buffer.slice(0, cut)) as { fact: string; payload: unknown };
        buffer = buffer.slice(cut + 1);
        void app.deliver(fact, payload)
          .catch((cause) => console.log(`\x1b[31m[${ME}]\x1b[0m ${fact} refused: ${(cause as Error).message}`));
      }
    });

    let done = false;
    const retry = () => {
      if (done) return;
      done = true;
      live = undefined;
      socket.destroy();
      console.log(`\x1b[2m[${ME}] link down — retrying in ${wait}ms\x1b[0m`);
      setTimeout(() => dial(Math.min(wait * 2, 5000)), wait);
    };
    socket.on('error', retry);
    socket.on('close', retry);
  };

  dial();

  const run = createLocalRunner(app);
  setInterval(() => {
    void run({ entity: 'sensor', op: 'report' }, { params: { node: ME }, query: {}, body: undefined, state: {} });
  }, 4000);
}

main().catch((err) => { console.error(err); process.exit(1); });
