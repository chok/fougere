/**
 * One frond, three ways to reach it — in memory, over HTTP, over a raw socket.
 *
 * Nothing in `fronds/**` knows any of this exists. The handler is a class, the
 * entity is a declaration, and the protocol is decided here, at the edge, by
 * the consumer. Run it and read the table: the same call gives the same value
 * and the same typed failure down all three paths.
 */
import { createApp, createLocalRunner, FougereError } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import type { App, InvocationContext, Transport } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { serve, createHttpTransport } from '@fougere/transport-http';
import { createSocketTransport, serveSocket } from './socket-transport.js';

const inv = (over: Partial<InvocationContext> = {}): InvocationContext =>
  ({ params: {}, query: {}, body: undefined, state: {}, ...over });

/** Run a call and keep whatever came out — a value or a typed failure. */
async function outcomeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    return render(await run());
  } catch (err) {
    if (err instanceof FougereError) return `\x1b[31m${err.code}\x1b[0m ${err.message}`;
    throw err;
  }
}

function render(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} rows · ${value.map((r) => (r as { station: string }).station).join(', ')}`;
  if (value && typeof value === 'object') {
    const row = value as { station?: string; celsius?: number };
    return row.station ? `${row.station} ${row.celsius}°C` : JSON.stringify(value);
  }
  return String(value);
}

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@fronds/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({ scan: await scanProject(import.meta.dirname), createContainer, ormFactory: createMemoryOrm });

  // Seed through the façade, so the judge sees the same rows a client would send.
  const local = createLocalRunner(app);
  for (const row of [
    { station: 'north-ridge', celsius: -4.5 },
    { station: 'harbour', celsius: 12.1 },
  ]) {
    await local({ entity: 'reading', op: 'create' }, inv({ body: row }));
  }

  // Three receivers over the SAME runner. One frond, three doors on the wire.
  const http = await serve(local, { port: 0 });
  const socket = await serveSocket(local);

  const paths: Array<[string, Transport]> = [
    ['in-process', local],
    [`http     :${http.port}`, createHttpTransport(`http://127.0.0.1:${http.port}`)],
    [`tcp      :${socket.port}`, createSocketTransport(socket.port)],
  ];

  const calls: Array<[string, string, InvocationContext]> = [
    ['list()', 'list', inv()],
    ['create({ station: "" })', 'create', inv({ body: { station: '', celsius: 3 } })],
    ['create({ celsius: 200 })', 'create', inv({ body: { station: 'dune', celsius: 200 } })],
    ['recalibrate()', 'recalibrate', inv()],
  ];

  console.log('\n  \x1b[32m🌿 fougere\x1b[0m  multi-transport — one frond, three protocols\n');
  for (const [label, op, invocation] of calls) {
    console.log(`  \x1b[1m${label}\x1b[0m`);
    for (const [name, transport] of paths) {
      const out = await outcomeOf(() => transport({ entity: 'reading', op }, invocation));
      console.log(`    \x1b[2m${name.padEnd(16)}\x1b[0m ${out}`);
    }
    console.log('');
  }

  // And the topology statement itself, over a protocol that is not HTTP. The
  // two lines below are the entire difference between a monolith and a split —
  // `remoteTransport` picks the transport off the address, so a second frond on
  // `http://` would simply come back through the other factory.
  const consumer = await createApp({
    scan: await scanProject(`${import.meta.dirname}/empty`),
    createContainer,
    remotes: { sensors: `tcp://127.0.0.1:${socket.port}` },
    remoteTransport: (url) =>
      url.startsWith('tcp://') ? createSocketTransport(Number(new URL(url).port)) : createHttpTransport(url),
  });

  type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;
  const facade = consumer.resolve<Facade>('readingHandler');
  console.log('  \x1b[1mconsumer.resolve("readingHandler").list()\x1b[0m  \x1b[2m— remotes: tcp://\x1b[0m');
  console.log(`    \x1b[2m${'via remotes:'.padEnd(16)}\x1b[0m ${render(await facade.list())}\n`);

  await consumer.dispose();
  await app.dispose();
  await http.close();
  socket.server.close();
  paths.forEach(([, t]) => (t as { close?: () => void }).close?.());
  process.exit(0);
}

function createMemoryOrm() {
  const store = new Map<string, Record<string, unknown>>();
  return {
    async list() { return [...store.values()]; },
    async findById(id: string) { return store.get(id); },
    async create(input: Record<string, unknown>) {
      const id = (input.id as string) ?? crypto.randomUUID();
      const record = { ...input, id };
      store.set(id, record);
      return record;
    },
    async update(id: string, input: Record<string, unknown>) {
      const existing = store.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      const updated = { ...existing, ...input, id };
      store.set(id, updated);
      return updated;
    },
    async delete(id: string) { return store.delete(id); },
  };
}

main();
