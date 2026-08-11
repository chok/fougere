/**
 * Repository B. It indexes. It has never heard of a blog.
 *
 * `app.listensTo()` is what it tells the broker — derived from its own signatures, so it
 * subscribes to exactly what its code accepts, and to nothing it does not.
 *
 * It also ACKS, and only when the fact was handled. `app.deliver()` resolves when every
 * local listener is done and rejects when one refused, so "did it land?" is a question
 * this process can actually answer — which is the whole of what a queue needs from
 * Fougere. The queue itself is in `broker.ts`, deliberately: a resolver holds nothing.
 */
import { createApp, setModuleLoader, frondAliases } from '@fougere/core';
import { createContainer } from '@fougere/container';

const BROKER = `http://127.0.0.1:${process.env.BROKER_PORT ?? 4300}`;
/** A DURABLE name — the broker keeps this subscriber's cursor under it, across restarts. */
const ME = process.env.SUBSCRIBER ?? 'search';

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({ root: import.meta.dirname, createContainer });

  // What this process listens to — read off its own code, declared nowhere else.
  const topics = app.listensTo();
  console.log(`\x1b[36m[search · pid ${process.pid}]\x1b[0m repository B — knows only itself`);
  console.log(`   listening for: ${topics.join(', ') || '(nothing)'}\n`);

  const stream = await fetch(`${BROKER}/subscribe?name=${ME}&topics=${topics.join(',')}`);
  const reader = stream.body!.getReader();
  const decode = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decode.decode(value, { stream: true });

    for (const frame of buffer.split('\n\n')) {
      if (!frame.startsWith('data: ')) continue;
      const { seq, topic, payload } = JSON.parse(frame.slice(6)) as { seq: number; topic: string; payload: unknown };

      try {
        // The local dispatch, unchanged: the same value the emitter would have called in
        // process. The judge, the binding and the middlewares apply exactly as always.
        await app.deliver(topic, payload);
      } catch {
        // Refused. Do NOT ack — the broker replays it on the next connection. Handling a
        // fact twice is the price of at-least-once, which is why `Fact<T>` promises to be
        // replayable in the first place.
        console.log(`\x1b[31m[search]\x1b[0m #${seq} refused — not acking, it will come back`);
        continue;
      }

      await fetch(`${BROKER}/ack`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: ME, seq }),
      });
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
