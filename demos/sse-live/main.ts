/**
 * Two readers watching the same door, and only one of them is told.
 *
 * `onEmit` is the only line that wires the frond to the live door, and it is the same
 * line `tunnel.ts` uses. What follows it is the demo: the carrier decides WHO hears,
 * and it pushes a name rather than a row.
 */
import { createApp, createLocalRunner, setModuleLoader, frondAliases } from '@fougere/core';
import type { App, InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { serveLive, watch, type Change } from './live.js';

const as = (name: string, over: Partial<InvocationContext> = {}): InvocationContext => ({
  params: {},
  query: {},
  body: undefined,
  state: { user: { id: `u-${name}`, name } },
  ...over,
});

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const settle = () => new Promise((r) => setTimeout(r, 120));

/** What a reader sees when it asks — always through the door, never from the push. */
async function seenBy(app: App, name: string): Promise<string> {
  const rows = (await createLocalRunner(app)({ entity: 'post', op: 'list' }, as(name))) as Array<{
    title: string;
    status: string;
  }>;
  if (rows.length === 0) return dim('0 rows');
  return rows.map((r) => `${r.title} ${dim(`(${r.status})`)}`).join(', ');
}

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const live = await serveLive();

  const app = await createApp({
    root: import.meta.dirname,
    createContainer,
    ormFactory: createMemoryOrm,
    // The whole wiring. The fact's own name and its own fields — nothing written by hand.
    // `fact` is the REGISTRATION name — `postChanged`, not the class name.
    onEmit: (fact, payload) => {
      if (fact !== 'postChanged') return;
      const change = payload as Change;
      const told = live.notify('post', change);
      console.log(
        `  ${dim('carrier')}  ${fact} → ${told.length ? told.join(', ') : dim('nobody')}`
        + dim(`   payload on the wire: { entity: 'post' }`),
      );
    },
  });

  const run = createLocalRunner(app);

  console.log(`\n  \x1b[32m🌿 fougere\x1b[0m  sse-live — ${bold('the listeners are not trusted peers')}\n`);
  console.log(dim('  tunnel.ts already showed a held connection, a registry and a fan-out.'));
  console.log(dim('  What is new here: who may be told, and what the push is allowed to carry.\n'));

  /**
   * What is on each reader's screen. It is written by the NUDGE and by nothing else —
   * a reader that is not told keeps showing what it last asked for, which is the honest
   * failure mode of this design and worth seeing.
   */
  const screen: Record<string, string> = {};
  const nudges: Record<string, number> = { alice: 0, bob: 0 };

  // Two readers on the same door. Same code, different identity.
  const stop = await Promise.all(
    ['alice', 'bob'].map((name) =>
      watch(live.port, name, async () => {
        nudges[name] += 1;
        screen[name] = await seenBy(app, name);
      }),
    ),
  );
  for (const name of ['alice', 'bob']) screen[name] = await seenBy(app, name);
  await settle();
  console.log(`  ${bold('alice')} and ${bold('bob')} are watching :${live.port}${dim('/live')}\n`);

  const show = () => {
    for (const name of ['alice', 'bob']) {
      console.log(`  ${dim(`${name}'s screen`.padEnd(14))} ${screen[name]} ${dim(`· ${nudges[name]} nudge(s)`)}`);
    }
    console.log('');
  };

  console.log(bold('1. alice drafts "Ferns unfurl in silence"'));
  await run({ entity: 'post', op: 'draft' }, as('alice', { body: { id: 'p1', title: 'Ferns unfurl in silence' } }));
  await settle();
  show();

  console.log(bold('2. alice publishes it'));
  await run({ entity: 'post', op: 'publish' }, as('alice', { params: { id: 'p1' } }));
  await settle();
  show();

  console.log(dim('  Read the two payload lines above: `{ entity: \'post\' }`, both times.'));
  console.log(dim('  Every title on this screen was answered by PostHandler.list, to a caller'));
  console.log(dim('  it identified. The push cannot leak what it does not carry.\n'));

  stop.forEach((abort) => abort());
  await live.close();
  await app.dispose();
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

main().catch((err) => { console.error(err); process.exit(1); });
