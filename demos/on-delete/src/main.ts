/**
 * One declaration, and the config line that decides who carries it out.
 *
 * Run it as it stands: everything shares one engine, so the foreign keys do the work and
 * nothing is read first. Uncomment `sources:` in fougere.config.ts and run again — the same
 * entities, the same rows left behind, and one line of boot output that is not the same.
 */
import { scanProject } from '@fougere/compiler';
import { createApp, createLocalRunner, Invocation, migrating, type App, type Storage } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { layerOf, storageFrom } from '@fougere/defaults';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import { workflow } from '@fougere/workflow';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const data = join(root, '.data');
rmSync(data, { recursive: true, force: true });

/** Read the demo's own config the way the boot does, so the comment block is the switch. */
const { default: config } = await import(join(root, 'fougere.config.ts')) as {
  default: { sources?: Record<string, { path: string; entities: string[] }> };
};
const split = config.sources !== undefined;

const storage = storageFrom({
  db: createSqliteSource({ path: join(data, 'app.db') }),
  sources: Object.fromEntries(Object.entries(config.sources ?? {}).map(([name, declared]) => [
    name,
    { source: createSqliteSource({ path: join(root, declared.path) }), entities: declared.entities },
  ])),
});

console.log(`\n${'─'.repeat(74)}`);
console.log(split
  ? 'sources: DECLARED — Comment in its own database, so one hop leaves the engine'
  : 'sources: commented out — one engine holds every key');
console.log('─'.repeat(74));

const app: App = await createApp({
  scan: await scanProject(root),
  createContainer,
  ...layerOf(storage),
  extensions: [migrating(storage.migrate), workflow({ sweepMs: 0 })],
});

const of = (entity: string) => app.storageFor(entity) as Storage;
const call = createLocalRunner(app);

await of('user').create({ id: 'ada', name: 'Ada' });
await of('user').create({ id: 'bob', name: 'Bob' });
await of('user').create({ id: 'carol', name: 'Carol' });
await of('post').create({ id: 'p1', title: 'Hello', authorId: 'ada', editorId: 'carol' });
await of('post').create({ id: 'p2', title: 'Again', authorId: 'ada' });
await of('comment').create({ id: 'c1', body: 'nice one', postId: 'p1', authorId: 'bob' });

/** What the three tables hold, in one line. */
const state = async () => {
  const [users, posts, comments] = await Promise.all(
    ['user', 'post', 'comment'].map(async (entity) => (await of(entity).list()).map((row: any) => row.id).sort()),
  );
  const p1 = await of('post').findById('p1') as { editorId?: string | null } | undefined;

  return `users ${users!.join(',') || '—'} · posts ${posts!.join(',') || '—'} `
    + `· comments ${comments!.join(',') || '—'} · p1.editor ${p1 ? (p1.editorId ?? 'none') : 'gone'}`;
};

const attempt = async (title: string, what: () => Promise<unknown>) => {
  console.log(`\n${title}`);
  console.log(`   before  ${await state()}`);
  try {
    await what();
    console.log('   →       done');
  } catch (failure) {
    console.log(`   →       ${(failure as Error).message}`);
  }
  console.log(`   after   ${await state()}`);
};

await attempt('1. a comment naming an author who does not exist',
  () => of('comment').create({ id: 'c9', body: 'ghost', postId: 'p1', authorId: 'nobody' }));

await attempt('2. deleting bob, who signed a comment — nothing says what becomes of it',
  () => of('user').delete('bob'));

await attempt('3. deleting carol, who only edits — the post stays, the field is emptied',
  () => of('user').delete('carol'));

await attempt('4. deleting ada — her posts go, and the comments hanging off them too',
  () => of('user').delete('ada'));

const runs = (await of('run').list()) as { id: string; status: string }[];
console.log(`\n   the journal holds ${runs.length} run(s): `
  + `${runs.map((run) => `${run.id} ${run.status}`).join(', ') || '—'}`);

console.log(`\n${'─'.repeat(74)}`);
console.log(split
  ? 'Two databases share no constraint, so the framework walked the tree itself: what names a\n'
    + 'row went before it. ONE hop leaving the engine hands it the WHOLE tree — a cascade the\n'
    + 'engine runs never passes through it, and the comments would have been left behind.'
  : 'One engine, so every hop was a key: no read, no walk, one statement. The declaration did\n'
    + 'not change, and neither did what is left.');
console.log(split
  ? 'Comment `sources:` out in fougere.config.ts and run again. The entities do not change.'
  : 'Uncomment `sources:` in fougere.config.ts and run again. The entities do not change.');
console.log(`${'─'.repeat(74)}\n`);

await call({ entity: 'run', op: 'sweep' }, Invocation.empty);
await app.dispose();
await storage.close!();
