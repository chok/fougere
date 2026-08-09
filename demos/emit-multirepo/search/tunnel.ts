/**
 * Repository B again — same fronds, same `IndexHandler`, another carrier.
 *
 * It opens the connection and says what it accepts. `app.listensTo()` is the handshake: no
 * list is written by hand, it comes off the `Fact<PostPublished>` in `IndexHandler`.
 */
import { connect } from 'node:net';
import { createApp, setModuleLoader, frondAliases } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';

const PORT = Number(process.env.TUNNEL_PORT ?? 4400);

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({ root: import.meta.dirname, createContainer });
  const topics = app.listensTo();

  console.log(`\x1b[36m[search · pid ${process.pid}]\x1b[0m repository B — knows only itself`);
  console.log(`   introducing itself for: ${topics.join(', ') || '(nothing)'}\n`);

  const socket = connect(PORT, '127.0.0.1', () => {
    socket.write(`${JSON.stringify({ subscribe: topics })}\n`);
  });

  socket.setEncoding('utf8');
  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk;
    let cut: number;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      const { fact, payload } = JSON.parse(line) as { fact: string; payload: unknown };
      // The same local dispatch as in-process — judge, binding and middlewares included.
      // It rejects when a listener refused; this carrier keeps nothing, so it can only
      // report. `main.ts` shows the other half: a broker that replays what was not acked.
      void app.deliver(fact, payload)
        .catch((cause) => console.log(`\x1b[31m[search]\x1b[0m ${fact} refused: ${(cause as Error).message}`));
    }
  });

  socket.on('close', () => { console.log('\x1b[36m[search]\x1b[0m tunnel closed — nothing is held'); });
}

main().catch((err) => { console.error(err); process.exit(1); });
