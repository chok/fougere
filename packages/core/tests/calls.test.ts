/**
 * What stands around a frond's calls is a link in front of `Dispatcher` — `implements
 * Partial<Dispatcher>` and an `inner`, handed each call as the `Call` it is. Two are ordered by the
 * frond (`ports:`), and an ancestor's stand outside its child's, the way the scope is read.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, Invocation, type Call, type Dispatcher } from '../src/index.js';
import { op } from './contract.js';

const trail: string[] = [];

class NoteHandler {
  async count() { trail.push('handler'); return 3; }
}

const link = (name: string) => class implements Partial<Dispatcher> {
  static readonly label = name;
  constructor(private inner: Pick<Dispatcher, 'dispatch'>) {}
  async dispatch(call: Call) {
    trail.push(`${name}:${call.address.address}.${call.address.operation}`);
    const answer = await this.inner.dispatch(call);
    trail.push(`/${name}`);

    return answer;
  }
};
const Timing = link('Timing');
const Audit = link('Audit');
const Family = link('Family');

const linkOf = (ctor: abstract new (...args: never[]) => unknown, name: string) =>
  ({ ctor, name, deps: ['Dispatcher'], implements: ['Dispatcher'] });

const notes = (providers: ReturnType<typeof linkOf>[], ports?: Record<string, string[]>) => frond('notes', {
  handlers: [{ ctor: NoteHandler, operations: { count: op({ cardinality: 'one' }) } }],
  providers,
  ...(ports ? { ports } : {}),
});

const run = async (fronds: ReturnType<typeof frond>[], under?: Record<string, { extends: string }>) => {
  trail.length = 0;
  await using app = await createApp({ fronds, createContainer, storageFactory: () => ({}) as never, ...(under ? { under } : {}) });
  const answer = await createLocalRunner(app)({ address: 'note', op: 'count' }, Invocation.empty);

  return { answer, trail: [...trail] };
};

describe('a link in front of the dispatch', () => {
  it('stands around every call of its frond, in the order the frond states', async () => {
    const out = await run([notes([linkOf(Timing, 'Timing'), linkOf(Audit, 'Audit')], { Dispatcher: ['Timing', 'Audit'] })]);

    expect(out.answer).toBe(3);
    expect(out.trail).toEqual(['Timing:note.count', 'Audit:note.count', 'handler', '/Audit', '/Timing']);
  });

  it('refuses two with no order, naming both', async () => {
    await expect(run([notes([linkOf(Timing, 'Timing'), linkOf(Audit, 'Audit')])])).rejects.toThrow(/Timing.*Audit|Audit.*Timing/);
  });

  it('stands one handler\'s inside its frond\'s, around that handler\'s calls alone', async () => {
    const Posts = link('Posts');
    class TagHandler { async count() { trail.push('tags'); return 1; } }
    const blog = frond('notes', {
      handlers: [
        { ctor: NoteHandler, operations: { count: op({ cardinality: 'one' }) } },
        { ctor: TagHandler, operations: { count: op({ cardinality: 'one' }) } },
      ],
      providers: [linkOf(Timing, 'Timing'), { ctor: Posts, name: 'Posts', deps: ['Dispatcher<NoteHandler>'], implements: ['Dispatcher<NoteHandler>'] }],
    });
    trail.length = 0;
    await using app = await createApp({ fronds: [blog], createContainer, storageFactory: () => ({}) as never });
    const run = createLocalRunner(app);
    await run({ address: 'note', op: 'count' }, Invocation.empty);
    await run({ address: 'tag', op: 'count' }, Invocation.empty);

    expect(trail).toEqual([
      'Timing:note.count', 'Posts:note.count', 'handler', '/Posts', '/Timing',
      'Timing:tag.count', 'tags', '/Timing',
    ]);
  });

  it('stands an ancestor\'s outside its child\'s', async () => {
    const family = frond('ops', { providers: [linkOf(Family, 'Family')] });
    const out = await run([family, notes([linkOf(Timing, 'Timing')])], { notes: { extends: 'ops' } });

    expect(out.trail).toEqual(['Family:note.count', 'Timing:note.count', 'handler', '/Timing', '/Family']);
  });
});
