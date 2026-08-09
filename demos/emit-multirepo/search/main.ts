/**
 * Repository B. It indexes. It has never heard of a blog.
 *
 * `app.listensTo()` is what it tells the broker — derived from its own signatures, so it
 * subscribes to exactly what its code accepts, and to nothing it does not.
 */
import { createApp, setModuleLoader, emitKeyOf } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';

const BROKER = `http://127.0.0.1:${process.env.BROKER_PORT ?? 4300}`;

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({ root: import.meta.dirname, createContainer });

  // What this process listens to — read off its own code, declared nowhere else.
  const topics = app.listensTo();
  console.log(`\x1b[36m[search · pid ${process.pid}]\x1b[0m repository B — knows only itself`);
  console.log(`   listening for: ${topics.join(', ') || '(nothing)'}\n`);

  const stream = await fetch(`${BROKER}/subscribe?topics=${topics.join(',')}`);
  const reader = stream.body!.getReader();
  const decode = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decode.decode(value, { stream: true });

    for (const frame of buffer.split('\n\n')) {
      if (!frame.startsWith('data: ')) continue;
      const { topic, payload } = JSON.parse(frame.slice(6)) as { topic: string; payload: unknown };
      // The local dispatch, unchanged: the same value the emitter would have called in
      // process. The judge, the binding and the middlewares apply exactly as always.
      const deliver = app.container.resolve<(f: unknown) => Promise<void>>(emitKeyOf(topic));
      await deliver(payload);
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
